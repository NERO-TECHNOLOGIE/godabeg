import databaseService from '../services/DatabaseService.js';

class Representative {
    static async findByCode(code) {
        const sql = `
            SELECT r.*, 
                   pv.nom as poste_nom, 
                   cv.nom as centre_nom, 
                   vq.nom as village_nom, 
                   a.nom as arrondissement_nom, 
                   c.nom as commune_nom, 
                   d.nom as departement_nom,
                   r.arrondissement_id,
                   r.poste_vote_id
            FROM representatives r
            LEFT JOIN poste_votes pv ON r.poste_vote_id = pv.id
            LEFT JOIN centre_votes cv ON pv.centre_vote_id = cv.id
            LEFT JOIN village_quartiers vq ON cv.village_quartier_id = vq.id
            LEFT JOIN arrondissements a ON vq.arrondissement_id = a.id OR r.arrondissement_id = a.id
            LEFT JOIN communes c ON a.commune_id = c.id
            LEFT JOIN departements d ON c.departement_id = d.id
            WHERE r.identification_code = ? LIMIT 1
        `;
        const results = await databaseService.query(sql, [code]);
        return results[0];
    }

    static async findByWhatsApp(whatsapp) {
        const results = await databaseService.query(
            'SELECT * FROM representatives WHERE whatsapp = ? LIMIT 1',
            [whatsapp]
        );
        return results[0];
    }

    static async existsByPhone(phone) {
        const results = await databaseService.query(
            'SELECT id FROM representatives WHERE telephone = ? LIMIT 1',
            [phone]
        );
        return results.length > 0;
    }

    static async create(data) {
        const sql = `
            INSERT INTO representatives (nom, prenoms, telephone, whatsapp, poste_vote_id, arrondissement_id, identification_code, registered_via, is_verified, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'whatsapp', 1, NOW(), NOW())
        `;
        const code = Math.floor(1000 + Math.random() * 9000).toString();
        const params = [
            data.nom,
            data.prenoms,
            data.telephone,
            data.whatsapp,
            data.poste_vote_id || null,
            data.arrondissement_id || null,
            code
        ];
        const result = await databaseService.query(sql, params);
        return { id: result.insertId, identification_code: code, ...data };
    }
}

export default Representative;
