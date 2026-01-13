import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import FormData from 'form-data';

dotenv.config({ path: path.join(process.cwd(), '.env') });

/**
 * ApiService - Centralized service for all API communications with Laravel backend
 * Handles authentication, data fetching, and result submissions
 */
class ApiService {
    constructor() {
        this.baseURL = process.env.API_BASE_URL || 'https://election.nerotechbenin.com/api';
        this.tokens = new Map(); // Store tokens per whatsapp user
        this.maxRetries = 3;
    }

    /**
     * Make an authenticated API request
     */
    async request(method, endpoint, data = null, whatsappId = null, isFormData = false) {
        const url = `${this.baseURL}${endpoint}`;
        const headers = {};

        // Add auth token if available
        if (whatsappId && this.tokens.has(whatsappId)) {
            headers['Authorization'] = `Bearer ${this.tokens.get(whatsappId)}`;
        }

        // Handle FormData
        if (isFormData && data instanceof FormData) {
            Object.assign(headers, data.getHeaders());
        } else if (!isFormData) {
            headers['Content-Type'] = 'application/json';
        }

        const config = {
            method,
            url,
            headers,
            ...(data && { data })
        };

        try {
            const response = await axios(config);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`[ApiService] ${method} ${endpoint} failed:`, error.response?.data || error.message);
            
            // Handle 401 - token expired
            if (error.response?.status === 401 && whatsappId) {
                console.log(`[ApiService] Token expired for ${whatsappId}, attempting re-authentication...`);
                this.tokens.delete(whatsappId);
                // Could attempt re-auth here, but for now just return error
            }

            return {
                success: false,
                error: error.response?.data || { message: error.message },
                status: error.response?.status
            };
        }
    }

    /**
     * Retry wrapper for network requests
     */
    async requestWithRetry(method, endpoint, data = null, whatsappId = null, isFormData = false) {
        let lastError;
        
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            const result = await this.request(method, endpoint, data, whatsappId, isFormData);
            
            if (result.success) {
                return result;
            }
            
            lastError = result;
            
            // Don't retry on client errors (4xx) except 401
            if (result.status >= 400 && result.status < 500 && result.status !== 401) {
                break;
            }
            
            // Wait before retry (exponential backoff)
            if (attempt < this.maxRetries) {
                const waitTime = Math.pow(2, attempt) * 1000;
                console.log(`[ApiService] Retry ${attempt}/${this.maxRetries} after ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
        }
        
        return lastError;
    }

    // ==================== AUTHENTICATION ====================

    /**
     * Authenticate a WhatsApp user and store token
     * Returns user data if successful, null if user doesn't exist
     */
    async authenticate(whatsappId) {
        const result = await this.requestWithRetry('POST', '/whatsapp/login', { whatsapp: whatsappId });
        
        if (result.success && result.data.token) {
            this.tokens.set(whatsappId, result.data.token);
            console.log(`[ApiService] Authenticated user: ${result.data.user.nom} ${result.data.user.prenom}`);
            return result.data.user;
        }
        
        if (result.status === 404) {
            console.log(`[ApiService] User not found for WhatsApp: ${whatsappId}`);
            return null;
        }
        
        throw new Error(`Authentication failed: ${result.error?.message || 'Unknown error'}`);
    }

    /**
     * Register a new WhatsApp user
     */
    async registerUser(data) {
        const result = await this.requestWithRetry('POST', '/whatsapp/register', data);
        
        if (result.success && result.data.token) {
            this.tokens.set(data.whatsapp, result.data.token);
            console.log(`[ApiService] Registered new user: ${result.data.user.nom} ${result.data.user.prenom}`);
            return result.data.user;
        }
        
        throw new Error(`Registration failed: ${JSON.stringify(result.error)}`);
    }

    /**
     * Check if a phone number is already registered
     */
    async checkPhoneExists(telephone) {
        const result = await this.requestWithRetry('POST', '/whatsapp/check-phone', { telephone });
        
        if (result.success) {
            return result.data.exists;
        }
        
        return false;
    }

    // ==================== LOCATION DATA ====================

    async getDepartments(whatsappId) {
        const result = await this.requestWithRetry('GET', '/locations/departments', null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch departments: ${result.error?.message}`);
    }

    async getCommunes(deptId, whatsappId) {
        const result = await this.requestWithRetry('GET', `/locations/communes/${deptId}`, null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch communes: ${result.error?.message}`);
    }

    async getArrondissements(communeId, whatsappId) {
        const result = await this.requestWithRetry('GET', `/locations/arrondissements/${communeId}`, null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch arrondissements: ${result.error?.message}`);
    }

    async getVillages(arrondId, whatsappId) {
        const result = await this.requestWithRetry('GET', `/locations/villages/${arrondId}`, null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch villages: ${result.error?.message}`);
    }

    async getCentresVote(arrondId, whatsappId) {
        const result = await this.requestWithRetry('GET', `/locations/centres/${arrondId}`, null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch centres de vote: ${result.error?.message}`);
    }

    async getPostesVote(centreId, whatsappId) {
        const result = await this.requestWithRetry('GET', `/locations/postes/${centreId}`, null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch postes de vote: ${result.error?.message}`);
    }

    async getPoliticalParties(whatsappId) {
        const result = await this.requestWithRetry('GET', '/locations/parties', null, whatsappId);
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to fetch political parties: ${result.error?.message}`);
    }

    // ==================== SUBMISSION STATUS ====================

    /**
     * Check if results already exist for a location
     */
    async checkSubmissionStatus(params, whatsappId) {
        const queryParams = new URLSearchParams();
        
        if (params.election_type) queryParams.append('election_type', params.election_type);
        if (params.arrondissement_id) queryParams.append('arrondissement_id', params.arrondissement_id);
        if (params.village_id) queryParams.append('village_id', params.village_id);
        if (params.poste_vote_id) queryParams.append('poste_vote_id', params.poste_vote_id);
        
        const result = await this.requestWithRetry(
            'GET',
            `/results/status/check?${queryParams.toString()}`,
            null,
            whatsappId
        );
        
        if (result.success) {
            return result.data;
        }
        
        throw new Error(`Failed to check submission status: ${result.error?.message}`);
    }

    // ==================== RESULT SUBMISSION ====================

    /**
     * Submit election results
     */
    async submitResults(submissionData, whatsappId) {
        const result = await this.requestWithRetry('POST', '/results/submit', submissionData, whatsappId);
        
        if (result.success) {
            console.log(`[ApiService] Results submitted successfully`);
            return result.data;
        }
        
        throw new Error(`Failed to submit results: ${JSON.stringify(result.error)}`);
    }

    /**
     * Upload PV photo
     */
    async uploadPhoto(photoBuffer, params, whatsappId) {
        try {
            const formData = new FormData();
            
            // Add the photo
            formData.append('pv_photo', photoBuffer, {
                filename: `pv_${Date.now()}.jpg`,
                contentType: 'image/jpeg'
            });
            
            // Add location parameters
            if (params.election_type) formData.append('election_type', params.election_type);
            if (params.arrondissement_id) formData.append('arrondissement_id', params.arrondissement_id);
            if (params.village_id) formData.append('village_id', params.village_id);
            if (params.poste_vote_id) formData.append('poste_vote_id', params.poste_vote_id);
            
            const result = await this.requestWithRetry('POST', '/results/photo', formData, whatsappId, true);
            
            if (result.success) {
                console.log(`[ApiService] Photo uploaded successfully`);
                return result.data;
            }
            
            throw new Error(`Failed to upload photo: ${JSON.stringify(result.error)}`);
        } catch (error) {
            console.error('[ApiService] Photo upload error:', error);
            throw error;
        }
    }

    /**
     * Clear stored token for a user (e.g., on logout or error)
     */
    clearToken(whatsappId) {
        this.tokens.delete(whatsappId);
    }
}

export default new ApiService();