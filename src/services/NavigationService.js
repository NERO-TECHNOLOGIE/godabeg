import apiService from './ApiService.js';
import stateService from './StateService.js';

class NavigationService {
    /**
     * Get the WhatsApp ID from state if we need it for auth
     */
    _getWhatsAppId(from) {
        // We need to pass whatsappId for authenticated requests
        // This assumes 'from' is already normalized
        return from;
    }

    /**
     * Get all departments
     */
    async getDepartments(from = null) {
        return await apiService.getDepartments(from);
    }

    /**
     * Get communes for a specific department
     */
    async getCommunes(departementId, from = null) {
        return await apiService.getCommunes(departementId, from);
    }

    /**
     * Get arrondissements for a specific commune
     */
    async getArrondissements(communeId, from = null) {
        return await apiService.getArrondissements(communeId, from);
    }

    /**
     * Get villages/quartiers for a specific arrondissement
     */
    async getVillages(arrondissementId, from = null) {
        return await apiService.getVillages(arrondissementId, from);
    }

    /**
     * Get centres de vote for a specific arrondissement
     */
    async getCentresVote(arrondissementId, from = null) {
        return await apiService.getCentresVote(arrondissementId, from);
    }

    /**
     * Get postes de vote for a specific centre de vote
     */
    async getPostesVoteByCentre(centreVoteId, from = null) {
        return await apiService.getPostesVote(centreVoteId, from);
    }

    /**
     * Format communes list as text
     */
    formatCommunesList(communes) {
        let text = "🏙️ *Sélectionnez votre COMMUNE :*\n\n";
        communes.forEach((commune, index) => {
            text += `${index + 1}. ${commune.nom}\n`;
        });
        text += "\n👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }

    /**
     * Format departments list as text
     */
    formatDepartmentsList(departments) {
        let text = "📍 *Sélectionnez votre DÉPARTEMENT :*\n\n";
        departments.forEach((dept, index) => {
            text += `${index + 1}. ${dept.nom}\n`;
        });
        text += "\n👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }

    /**
     * Format arrondissements list as text
     */
    formatArrondissementsList(arrondissements) {
        let text = "🏢 *Sélectionnez votre ARRONDISSEMENT :*\n\n";
        arrondissements.forEach((arr, index) => {
            text += `${index + 1}. ${arr.nom}\n`;
        });
        text += "\n👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }

    /**
     * Format villages/quartiers list as text
     */
    formatVillagesList(villages) {
        let text = "🏡 *Sélectionnez votre VILLAGE/QUARTIER :*\n\n";
        villages.forEach((v, index) => {
            text += `${index + 1}. ${v.nom}\n`;
        });
        text += "\n👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }

    /**
     * Format centres de vote list as text
     */
    formatCentresVoteList(centres) {
        let text = "🏫 *Sélectionnez le CENTRE DE VOTE :*\n\n";
        centres.forEach((cv, index) => {
            text += `${index + 1}. ${cv.nom}\n`;
        });
        text += "\n👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }

    /**
     * Format postes de vote list as text
     */
    formatPostesVoteList(postes) {
        let text = "🗳️ *Sélectionnez le POSTE DE VOTE :*\n\n";
        postes.forEach((poste, index) => {
            text += `${index + 1}. ${poste.poste_nom}\n`;
            text += `   📍 ${poste.village_nom} - ${poste.centre_nom}\n\n`;
        });
        text += "\n👉épondez avec le *numéro* correspondant (ou 0 pour annuler)";
        return text;
    }
}

export default new NavigationService();