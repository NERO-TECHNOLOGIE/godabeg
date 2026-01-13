import express from 'express';
import instanceManager from './services/InstanceManager.js';
import qrcode from 'qrcode';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Initialize a new instance
app.post('/instances/init/:id', async (req, res) => {
    const { id } = req.params;
    const result = await instanceManager.initInstance(id);
    if (result.success) {
        res.json(result);
    } else {
        res.status(400).json(result);
    }
});

// Get status of all instances
app.get('/instances/status', (req, res) => {
    const statuses = instanceManager.getAllInstances();
    res.json(statuses);
});

// Get QR code for a specific instance
app.get('/instances/qr/:id', async (req, res) => {
    const { id } = req.params;
    const instance = instanceManager.getInstance(id);
    
    if (!instance) {
        return res.status(404).json({ error: 'Instance not found' });
    }
    
    if (instance.status === 'ready') {
        return res.json({ message: 'Instance is already connected' });
    }
    
    if (!instance.qr) {
        return res.status(202).json({ message: 'QR code not yet generated, please wait or check status' });
    }

    try {
        const qrImage = await qrcode.toDataURL(instance.qr);
        res.send(`<img src="${qrImage}" />`);
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate QR image' });
    }
});

// Stop an instance
app.post('/instances/stop/:id', async (req, res) => {
    const { id } = req.params;
    const success = await instanceManager.stopInstance(id);
    if (success) {
        res.json({ message: `Instance ${id} stopped` });
    } else {
        res.status(404).json({ error: 'Instance not found' });
    }
});

app.listen(port, () => {
    console.log(`Management API listening at http://localhost:${port}`);
});
