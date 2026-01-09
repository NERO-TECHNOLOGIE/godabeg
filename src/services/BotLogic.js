import stateService from './StateService.js';
import apiService from './ApiService.js';
import navigationService from './NavigationService.js';
import fs from 'fs/promises';
import path from 'path';

// Disclaimer constant
const WELCOME_DISCLAIMER = `⚠️*INFORMATION IMPORTANTE*⚠️

🔒 *Confidentialité :* Cette conversation est PRIVÉE et toutes les données que vous fournirez sont collectées de manière SÉCURISÉE et confidentielle.

⚖️ *Aspect Légal :* La soumission de résultats électoraux via cette plateforme est EXCLUSIVEMENT réservée aux personnes officiellement désignées par l' *Union Progressiste le Renouveau (UP)*.

🚨 *Conséquences :* Toute soumission frauduleuse, falsifiée ou non autorisée entraînera des POURSUITES JUDICIAIRES conformément au *code du numérique au Bénin*. Si vous n'êtes PAS habilité(e) par l'UP à soumettre des résultats, veuillez vous ABSTENIR de continuer.

Tapez *1* pour accepter ou *0* pour quitter.`;

class BotLogic {
    async handleMessage(client, msg) {
        const fullId = msg.from; // Raw WhatsApp ID (JID) for sendMessage
        const from = this.normalizeId(fullId); // Normalized ID for logic/state
        const text = msg.body ? msg.body.trim() : '';
        
        try {
            // Show typing status and wait
            const chat = await msg.getChat();
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, 2000));
            await chat.clearState();
        } catch (e) {
            console.warn(`[BotLogic] Could not set typing state for ${from}:`, e.message);
        }

        try {
            if (msg.hasMedia) {
                return this.handleMedia(client, msg);
            }

            const currentFlow = stateService.getCurrentFlow(from);
            const currentStep = stateService.getCurrentStep(from);

            // Annulation (0 au lieu de XX)
            if (text && text.trim() === '0') {
                const isSubmissionValue = (currentFlow === 'submit' && 
                    ['bulletins_nuls', 'party_votes', 'pv_upload'].includes(currentStep));

                if (!isSubmissionValue) {
                    stateService.clearState(from);
                    return client.sendMessage(fullId, "❌ Opération annulée.\n\nEnvoyez un nouveau message pour revenir au menu d'accueil merci.");
                }
            }

            // Handle disclaimer acceptance
            if (currentFlow === 'welcome' && currentStep === 'disclaimer') {
                if (text && text.trim() === '1') {
                    stateService.addData(from, 'disclaimer_accepted', true);
                    return this.showMainMenu(client, fullId);
                } else {
                    return client.sendMessage(fullId, "⚠️ Vous devez taper *1* pour accepter et continuer, ou *0* pour quitter.");
                }
            }

            if (!currentFlow || currentFlow === 'main_menu') {
                // Check if user exists by trying to authenticate
                let user = null;
                try {
                    user = await apiService.authenticate(from);
                } catch (error) {
                    console.log(`[BotLogic] Authentication check failed for ${from}, treating as new user`);
                }
                
                if (!user) {
                    // New user: option 1 = registration
                    if (text === '1') return this.startRegistrationFlow(client, fullId);
                } else {
                    // Registered user: option 1 = submit, option 2 = modify (also submit)
                    if (text === '1') {
                        stateService.addData(from, 'is_modification', false);
                        return this.startSubmitFlow(client, fullId);
                    }
                    if (text === '2') {
                        stateService.addData(from, 'is_modification', true);
                        return this.startSubmitFlow(client, fullId);
                    }
                }
                
                return this.showMainMenu(client, fullId);
            }

            switch (currentFlow) {
                case 'registration':
                    return this.handleRegistration(client, fullId, currentStep, text);
                case 'submit':
                    return this.handleSubmit(client, fullId, currentStep, text);
                default:
                    return this.showMainMenu(client, fullId);
            }
        } catch (error) {
            console.error(`[BotLogic] Error handling message from ${from}:`, error);
            try {
                await client.sendMessage(fullId, "❌ Une erreur inattendue est survenue. Veuillez réessayer plus tard.");
            } catch (sendError) {
                console.error(`[BotLogic] Critical: Failed to send error message to ${from}:`, sendError);
            }
        }
    }

    async showMainMenu(client, fullId) {
        const from = this.normalizeId(fullId);
        // Check if user already exists by trying to authenticate
        let user = null;
        try {
            user = await apiService.authenticate(from);
        } catch (error) {
            console.log(`[BotLogic] User not found for ${from}`);
        }
        
        // If user doesn't exist and hasn't accepted disclaimer, show disclaimer
        if (!user) {
            const hasAcceptedDisclaimer = stateService.getData(from, 'disclaimer_accepted', false);
            if (!hasAcceptedDisclaimer) {
                stateService.setState(from, 'welcome', 'disclaimer');
                return client.sendMessage(fullId, WELCOME_DISCLAIMER);
            }
        }

        // Show appropriate menu based on user registration status
        let text = "*Bienvenue sur PV-COLLECT*\n\n";
        text += "_Plateforme simplifiée de collecte des résultats de l'Union Progressiste le Renouveau_\n\n";
        text += "*IMPORTANT :* Vous pouvez également soumettre vos résultats via Telegram ici : https://t.me/pvcollect_bot ou via ces deux numéros WhatsApp : https://wa.me/22951109108 ou https://wa.me/22951248454\n\n";
        
        if (!user) {
            // New user menu
            text += "1- Je veux m'inscrire\n\n";
            text += "*Tapez 1 pour commencer* (ou 0 pour quitter)";
        } else {
            // Registered user menu
            text += `Bonjour *${user.nom} ${user.prenom}* !\n\n`;
            text += "1- J'envoie des résultats\n";
            text += "2- Je modifie un résultat\n\n";
            text += "*Tapez le chiffre correspondant* (ou 0 pour quitter)";
        }

        const currentData = stateService.getData(from);
        stateService.clearState(from);
        
        // Restore essential session data if needed
        if (currentData.disclaimer_accepted) {
            stateService.addData(from, 'disclaimer_accepted', true);
        }

        stateService.setState(from, 'main_menu', 'selection');
        return client.sendMessage(fullId, text);
    }

    // --- REGISTRATION FLOW ---
    async startRegistrationFlow(client, fullId) {
        const from = this.normalizeId(fullId);
        stateService.setState(from, 'registration', 'nom');
        return client.sendMessage(fullId, "📝 Commençons votre inscription.\n\nÉcrivez votre *NOM* de famille (ou 0 pour annuler) :");
    }

    async handleRegistration(client, fullId, step, text) {
        const from = this.normalizeId(fullId);
        switch (step) {
            case 'nom':
                stateService.addData(from, 'nom', text.trim());
                stateService.setState(from, 'registration', 'prenom');
                return client.sendMessage(fullId, "Écrivez vos *PRÉNOMS* :");

            case 'prenom':
                stateService.addData(from, 'prenom', text.trim());
                stateService.setState(from, 'registration', 'telephone');
                return client.sendMessage(fullId, "Entrez votre *NUMÉRO DE TÉLÉPHONE* (Commencez par 229, ex: 2290197XXXXXX) :");

            case 'telephone':
                let tel = text.replace(/[^0-9]/g, '');
                if (!tel.startsWith('229') || tel.length < 11) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Il doit commencer par 229 et avoir au moins 11 chiffres. Réessayez :");
                }
                const phoneExists = await apiService.checkPhoneExists(tel);
                if (phoneExists) {
                    return client.sendMessage(fullId, "❌ Ce numéro est déjà enregistré.");
                }
                stateService.addData(from, 'telephone', tel);
                return this.completeRegistration(client, fullId);
        }
    }

    async completeRegistration(client, fullId) {
        const from = this.normalizeId(fullId);
        const data = stateService.getData(from);
        
        try {
            const user = await apiService.registerUser({
                nom: data.nom,
                prenom: data.prenom,
                telephone: data.telephone,
                whatsapp: from
            });

            // Clear state and mark disclaimer as accepted in session
            stateService.clearState(from);
            stateService.addData(from, 'disclaimer_accepted', true);
            
            let msg = `✅ Inscription réussie *${user.nom} ${user.prenom}* !\n\n`;
            msg += "Vous pouvez maintenant soumettre vos résultats.\n\n";
            await client.sendMessage(fullId, msg);
            
            // Directly show main menu with submission options
            return this.showMainMenu(client, fullId);
        } catch (error) {
            console.error('[BotLogic] Registration failed:', error);
            stateService.clearState(from);
            return client.sendMessage(fullId, "❌ Erreur lors de l'inscription. Veuillez réessayer.");
        }
    }

    // --- SUBMIT FLOW ---
    async startSubmitFlow(client, fullId) {
        const from = this.normalizeId(fullId);
        // Direct access: no code required
        return this.startSubmitSession(client, fullId);
    }

    async handleSubmit(client, fullId, step, text) {
        const from = this.normalizeId(fullId);
        switch (step) {
            case 'election_type':
                let type = '';
                if (text === '1') type = 'legislatives';
                else if (text === '2') type = 'communales';
                else if (text === '3') type = 'locales';
                else return client.sendMessage(fullId, "❌ Option invalide. Tapez 1, 2 ou 3 :");
                
                stateService.addData(from, 'election_type', type);
                
                // Show department selection
                const departments = await navigationService.getDepartments(from);
                stateService.addData(from, 'departments', departments);
                stateService.setState(from, 'submit', 'department');
                return client.sendMessage(fullId, navigationService.formatDepartmentsList(departments));

            case 'department':
                const departmentsData = stateService.getData(from, 'departments');
                const deptIndex = parseInt(text) - 1;
                if (isNaN(deptIndex) || deptIndex < 0 || deptIndex >= departmentsData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedDept = departmentsData[deptIndex];
                stateService.addData(from, 'departement_id', selectedDept.id);
                
                const communes = await navigationService.getCommunes(selectedDept.id, from);
                if (communes.length === 0) {
                    return client.sendMessage(fullId, "❌ Aucune commune trouvée pour ce département.");
                }
                stateService.addData(from, 'communes', communes);
                stateService.setState(from, 'submit', 'commune');
                return client.sendMessage(fullId, navigationService.formatCommunesList(communes));

            case 'commune':
                const communesData = stateService.getData(from, 'communes');
                const comIndex = parseInt(text) - 1;
                if (isNaN(comIndex) || comIndex < 0 || comIndex >= communesData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedCom = communesData[comIndex];
                stateService.addData(from, 'commune_id', selectedCom.id);

                const arrondissements = await navigationService.getArrondissements(selectedCom.id, from);
                if (arrondissements.length === 0) {
                    return client.sendMessage(fullId, "❌ Aucun arrondissement trouvé pour cette commune.");
                }
                stateService.addData(from, 'arrondissements', arrondissements);
                stateService.setState(from, 'submit', 'arrondissement');
                return client.sendMessage(fullId, navigationService.formatArrondissementsList(arrondissements));
            
            case 'arrondissement': {
                const arrondissementsData = stateService.getData(from, 'arrondissements');
                const arrIndex = parseInt(text) - 1;
                if (isNaN(arrIndex) || arrIndex < 0 || arrIndex >= arrondissementsData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedArr = arrondissementsData[arrIndex];
                stateService.addData(from, 'arrondissement_id', selectedArr.id);
                
                const electionType = stateService.getData(from, 'election_type');

                // If LEGISLATIVES or COMMUNALES, stop at Arrondissement
                if (electionType === 'legislatives' || electionType === 'communales') {
                    // Check submission status via API
                    try {
                        const statusCheck = await apiService.checkSubmissionStatus({
                            election_type: electionType,
                            arrondissement_id: selectedArr.id
                        }, from);

                        if (statusCheck.exists) {
                            const isModification = stateService.getData(from, 'is_modification');

                            if (!statusCheck.submitted_by_self) {
                                stateService.clearState(from);
                                return client.sendMessage(fullId, 
                                    `❌ Non autorisé.\n\n` +
                                    `Cet arrondissement a déjà été soumis par *${statusCheck.user.nom} ${statusCheck.user.prenom}*.\n` +
                                    "Vous ne pouvez pas modifier les résultats d'un autre utilisateur."
                                );
                            } else if (!isModification) {
                                stateService.clearState(from);
                                return client.sendMessage(fullId, 
                                    `⚠️ Vous avez déjà soumis pour cet arrondissement.\n\n` +
                                    "Utilisez l'option *2- Modifier un résultat* du menu principal pour changer vos résultats."
                                );
                            }
                        }
                    } catch (error) {
                        console.error('[BotLogic] Error checking submission status:', error);
                    }

                    stateService.setState(from, 'submit', 'bulletins_nuls');
                    return client.sendMessage(fullId, "🔢 Nombre de bulletins nuls (ou 0 pour annuler) :");
                }

                // If LOCAL, continue to Village/Quartier
                const villages = await navigationService.getVillages(selectedArr.id, from);
                if (villages.length === 0) {
                    stateService.clearState(from);
                    return client.sendMessage(fullId, "❌ Aucun village/quartier trouvé pour cet arrondissement.");
                }
                stateService.addData(from, 'villages', villages);
                stateService.setState(from, 'submit', 'village');
                return client.sendMessage(fullId, navigationService.formatVillagesList(villages));
            }

            case 'village': {
                const villagesData = stateService.getData(from, 'villages');
                const villageIndex = parseInt(text) - 1;
                if (isNaN(villageIndex) || villageIndex < 0 || villageIndex >= villagesData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedVillage = villagesData[villageIndex];
                const electionType = stateService.getData(from, 'election_type');
                const isModification = stateService.getData(from, 'is_modification');

                // Check submission status via API
                try {
                    const statusCheck = await apiService.checkSubmissionStatus({
                        election_type: electionType,
                        village_id: selectedVillage.id
                    }, from);

                    if (statusCheck.exists) {
                        if (!statusCheck.submitted_by_self) {
                            stateService.clearState(from);
                            return client.sendMessage(fullId, 
                                `❌ Ce lieu a déjà été soumis par *${statusCheck.user.nom} ${statusCheck.user.prenom}*.\n\n` +
                                "Vous ne pouvez pas modifier les résultats d'un autre utilisateur."
                            );
                        } else if (!isModification) {
                            stateService.clearState(from);
                            return client.sendMessage(fullId, 
                                `⚠️ Vous avez déjà soumis pour ce village/quartier.\n\n` +
                                "Utilisez l'option *2- Modifier un résultat* du menu principal pour changer vos résultats."
                            );
                        }
                    }
                } catch (error) {
                    console.error('[BotLogic] Error checking submission status:', error);
                }

                stateService.addData(from, 'village_quartier_id', selectedVillage.id);
                stateService.setState(from, 'submit', 'bulletins_nuls');
                return client.sendMessage(fullId, "🔢 Nombre de bulletins nuls (ou 0 pour annuler) :");
            }

            case 'centre_vote': {
                const centresData = stateService.getData(from, 'centres');
                const centreIndex = parseInt(text) - 1;
                if (isNaN(centreIndex) || centreIndex < 0 || centreIndex >= centresData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedCentre = centresData[centreIndex];
                stateService.addData(from, 'centre_vote_id', selectedCentre.id);

                const postes = await navigationService.getPostesVoteByCentre(selectedCentre.id, from);
                if (postes.length === 0) {
                    stateService.clearState(from);
                    return client.sendMessage(fullId, "❌ Aucun poste de vote trouvé.");
                }
                stateService.addData(from, 'postes', postes);
                stateService.setState(from, 'submit', 'poste_vote');
                return client.sendMessage(fullId, navigationService.formatPostesVoteList(postes));
            }
            
            case 'poste_vote': {
                const postesData = stateService.getData(from, 'postes');
                const posteIndex = parseInt(text) - 1;
                if (isNaN(posteIndex) || posteIndex < 0 || posteIndex >= postesData.length) {
                    return client.sendMessage(fullId, "❌ Numéro invalide. Réessayez :");
                }
                const selectedPoste = postesData[posteIndex];
                const electionType = stateService.getData(from, 'election_type');
                const isModification = stateService.getData(from, 'is_modification');
                
                // Check submission status via API
                try {
                    const statusCheck = await apiService.checkSubmissionStatus({
                        election_type: electionType,
                        poste_vote_id: selectedPoste.id
                    }, from);

                    if (statusCheck.exists) {
                        if (!statusCheck.submitted_by_self) {
                            stateService.clearState(from);
                            return client.sendMessage(fullId, 
                                `❌ Ce lieu a déjà été soumis par un autre représentant.\n\n` +
                                "Vous ne pouvez pas modifier les résultats d'un autre représentant."
                            );
                        } else if (!isModification) {
                            stateService.clearState(from);
                            return client.sendMessage(fullId, 
                                `⚠️ Vous avez déjà soumis pour ce poste.\n\n` +
                                "Utilisez l'option *2- Modifier un résultat* du menu principal pour modifier vos résultats."
                            );
                        }
                    }
                } catch (error) {
                    console.error('[BotLogic] Error checking submission status:', error);
                }
                
                stateService.addData(from, 'poste_vote_id', selectedPoste.id);
                stateService.setState(from, 'submit', 'bulletins_nuls');
                return client.sendMessage(fullId, "🔢 Nombre de bulletins nuls (ou 0 pour annuler) :");
            }

            case 'bulletins_nuls':
                if (!/^\d+$/.test(text)) return client.sendMessage(fullId, "❌ Entrez uniquement des chiffres :");
                stateService.addData(from, 'bulletins_nuls', parseInt(text));
                return this.requestNextParty(client, fullId);

            case 'party_votes':
                if (!/^\d+$/.test(text)) return client.sendMessage(fullId, "❌ Entrez uniquement des chiffres :");
                const parties = stateService.getData(from, 'parties');
                const idx = stateService.getData(from, 'current_party_index');
                const partyKey = parties[idx].toLowerCase().replace(/ /g, '_');
                stateService.addData(from, partyKey, parseInt(text));
                
                if (idx + 1 < parties.length) {
                    stateService.addData(from, 'current_party_index', idx + 1);
                    return client.sendMessage(fullId, `Suffrages *${parties[idx+1]}* :`);
                }
                return this.showSummary(client, fullId);

            case 'confirmation':
                if (text === '1') {
                    return this.saveResults(client, fullId);
                } else {
                    stateService.clearState(from);
                    return client.sendMessage(fullId, "❌ Opération annulée.");
                }
        }
    }

    async startSubmitSession(client, fullId) {
        const from = this.normalizeId(fullId);
        
        // User should already be authenticated at this point
        // We don't need to fetch user again, just verify auth is still valid
        try {
            const user = await apiService.authenticate(from);
            
            if (!user) {
                stateService.clearState(from);
                return client.sendMessage(fullId, "❌ Utilisateur non enregistré. Veuillez vous inscrire d'abord.");
            }

            stateService.addData(from, 'user_id', user.id);
            
            stateService.setState(from, 'submit', 'election_type');
            
            let msg = `✅ Bienvenue, *${user.nom} ${user.prenom}* !\n\n`;
            msg += "*Choisissez le TYPE d'ÉLECTION :*\n\n";
            msg += "1- Législatives\n";
            msg += "2- Communales\n";
            msg += "3- Locales\n\n";
            msg += "👉 Répondez avec le *numéro* correspondant (ou 0 pour annuler)";
            return client.sendMessage(fullId, msg);
        } catch (error) {
            console.error('[BotLogic] Error in startSubmitSession:', error);
            stateService.clearState(from);
            return client.sendMessage(fullId, "❌ Erreur lors de l'authentification. Veuillez réessayer.");
        }
    }

    async requestNextParty(client, fullId) {
        const from = this.normalizeId(fullId);
        const electionType = stateService.getData(from, 'election_type');
        let parties = ['UPR', 'BR', 'FCBE'];
        if (electionType === 'legislatives') parties.push('MOELE BENIN', 'LD');
        
        stateService.addData(from, 'parties', parties);
        stateService.addData(from, 'current_party_index', 0);
        stateService.setState(from, 'submit', 'party_votes');

        return client.sendMessage(fullId, `Suffrages *${parties[0]}* :`);
    }

    async showSummary(client, fullId) {
        const from = this.normalizeId(fullId);
        const data = stateService.getData(from);
        const parties = data.parties;
        
        let total = data.bulletins_nuls || 0;
        for (const p of parties) {
            const key = p.toLowerCase().replace(/ /g, '_');
            total += (data[key] || 0);
        }

        let summary = "*Récapitulatif :*\n\n";
        
        const percNuls = total > 0 ? ((data.bulletins_nuls / total) * 100).toFixed(2) : 0;
        summary += `Bulletins nuls : ${data.bulletins_nuls} (${percNuls}%)\n`;
        
        for (const p of parties) {
            const key = p.toLowerCase().replace(/ /g, '_');
            const count = data[key] || 0;
            const perc = total > 0 ? ((count / total) * 100).toFixed(2) : 0;
            summary += `${p} : ${count} (${perc}%)\n`;
        }
        
        summary += `\n*Total Votes : ${total}*\n`;
        summary += "\n*Valider ?*\n1- OUI\n2- NON (ou 0 pour annuler)";
        stateService.setState(from, 'submit', 'confirmation');
        return client.sendMessage(fullId, summary);
    }

    async saveResults(client, fullId) {
        const from = this.normalizeId(fullId);
        const data = stateService.getData(from);
        const parties = data.parties;
        
        try {
            // Build results payload for API
            const resultsPayload = {
                election_type: data.election_type,
                arrondissement_id: data.arrondissement_id || null,
                village_id: data.village_quartier_id || null,
                poste_vote_id: data.poste_vote_id || null,
                results: {
                    bulletins_nuls: data.bulletins_nuls || 0
                }
            };

            // Add party votes
            for (const p of parties) {
                const key = p.toLowerCase().replace(/ /g, '_');
                resultsPayload.results[key] = data[key] || 0;
            }

            // Submit via API
            await apiService.submitResults(resultsPayload, from);

            stateService.setState(from, 'submit', 'pv_upload');
            return client.sendMessage(fullId, "✅ Résultats enregistrés !\n\n📸 Envoyez maintenant la *PHOTO du PV* (ou 0 pour terminer).");
        } catch (error) {
            console.error("[BotLogic] Results submission error:", error);
            stateService.clearState(from);
            return client.sendMessage(fullId, "❌ Une erreur est survenue lors de l'enregistrement. Veuillez réessayer.");
        }
    }

    async handleMedia(client, msg) {
        const fullId = msg.from;
        const from = this.normalizeId(fullId);
        const currentFlow = stateService.getCurrentFlow(from);
        const currentStep = stateService.getCurrentStep(from);

        if (currentFlow !== 'submit' || currentStep !== 'pv_upload') {
            return client.sendMessage(fullId, "❌ Aucune photo attendue pour le moment.");
        }

        try {
            const media = await msg.downloadMedia();
            if (!media) throw new Error("Impossible de télécharger le média");

            // Convert base64 to buffer
            const photoBuffer = Buffer.from(media.data, 'base64');

            const data = stateService.getData(from);
            
            // Upload photo via API
            await apiService.uploadPhoto(photoBuffer, {
                election_type: data.election_type,
                arrondissement_id: data.arrondissement_id || null,
                village_id: data.village_quartier_id || null,
                poste_vote_id: data.poste_vote_id || null
            }, from);

            stateService.clearState(from);
            return client.sendMessage(fullId, "✅ Image du PV sauvegardée !\n\nEnvoyez un nouveau message pour revenir au menu d'accueil merci.");

        } catch (error) {
            console.error("[BotLogic] Media upload error:", error);
            stateService.clearState(from);
            return client.sendMessage(fullId, "❌ Erreur lors de la sauvegarde. Réessayez.");
        }
    }

    normalizeId(id) {
        // Remove @c.us and any device suffix (e.g. :1, :0)
        return id.split('@')[0].split(':')[0];
    }
}

export default new BotLogic();
