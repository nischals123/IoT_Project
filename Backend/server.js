const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB URI
const mongoURI = 'mongodb+srv://hamroparking:hamropark%40098@iot.qpglu.mongodb.net/'; // Replace with your MongoDB connection string

// Connect to MongoDB
mongoose.connect(mongoURI, {
    serverApi:{
        version: '1',
        strict: false,
        deprecationErrors: true
    }
})
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Error connecting to MongoDB:', err));

// Define Parking Event Schema
const parkingEventSchema = new mongoose.Schema({
    slotId: { type: Number, required: true }, // The slot the vehicle used
    vehicleNumber: { type: String, required: true }, // Vehicle's number plate
    inTime: { type: String, required: true }, // Entry time
    outTime: { type: String, default: null }, // Exit time
    duration: { type: String, default: null }, // Duration of the parking
});

// Define Parking Slot Schema
const parkingSlotSchema = new mongoose.Schema({
    id: { type: Number, required: true, unique: true }, // Slot ID
    currentEvent: { type: mongoose.Schema.Types.ObjectId, ref: 'ParkingEvent', default: null }, // Current ongoing event (if any)
});

// Calculate duration
function calculateDuration(inTime, outTime) {
    try {
        const inDate = new Date(`1970-01-01T${inTime}`);
        const outDate = new Date(`1970-01-01T${outTime}`);
        if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) {
            return 'Invalid time format';
        }
        const duration = (outDate - inDate) / (1000 * 60 * 60); // Duration in hours
        return `${duration.toFixed(2)} hrs`;
    } catch (error) {
        return 'Error calculating duration';
    }
}

// Create Models
const ParkingEvent = mongoose.model('ParkingEvent', parkingEventSchema);
const ParkingSlot = mongoose.model('ParkingSlot', parkingSlotSchema);

// Initialize Parking Slots
async function initializeSlots() {
    try {
        const count = await ParkingSlot.countDocuments();
        if (count === 0) {
            const slots = Array.from({ length: 6 }, (_, i) => ({ id: i + 1 })); // Create 6 slots
            await ParkingSlot.insertMany(slots);
            console.log('Parking slots initialized');
        }
    } catch (error) {
        console.error('Error initializing parking slots:', error);
    }
}
initializeSlots();

// Root endpoint
app.get('/', (req, res) => {
    res.send('Welcome to the Parking Slot Management API');
});

// Get all parking slots with their current status
app.get('/slots', async (req, res) => {
    try {
        const slots = await ParkingSlot.find()
            .populate('currentEvent') // Populate current event details
            .exec();
        const response = slots.map(slot => ({
            id: slot.id,
            currentStatus: slot.currentEvent ? 'Occupied' : 'Available',
            currentEvent: slot.currentEvent || null,
        }));
        res.status(200).json(response);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving parking slots', error: err.message });
    }
});

// Get all parking slots with their current status
app.get('/event', async (req, res) => {
    try {
        const slots = await ParkingEvent.find()
            
        res.status(200).json(slots);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving parking slots', error: err.message });
    }
});

// Record entry for a slot
app.post('/entry/:slotId', async (req, res) => {
    const { slotId } = req.params;
    const { vehicleNumber, inTime } = req.body;

    try {
        const slot = await ParkingSlot.findOne({ id: parseInt(slotId) });
        if (!slot) {
            return res.status(404).json({ message: 'Slot not found' });
        }

        if (slot.currentEvent) {
            return res.status(400).json({ message: 'Slot is currently occupied' });
        }

        // Create a new parking event
        const event = new ParkingEvent({
            slotId: slot.id,
            vehicleNumber,
            inTime,
        });
        await event.save();

        // Link the event to the slot
        slot.currentEvent = event._id;
        await slot.save();

        res.status(200).json({ message: `Entry recorded for Slot ${slotId}`, event });
    } catch (err) {
        res.status(500).json({ message: 'Error recording entry', error: err.message });
    }
});

// Record exit for a slot
app.post('/exit/:slotId', async (req, res) => {
    const { slotId } = req.params;
    const { outTime } = req.body;

    try {
        const slot = await ParkingSlot.findOne({ id: parseInt(slotId) }).populate('currentEvent');
        if (!slot || !slot.currentEvent) {
            return res.status(404).json({ message: 'Slot is not currently occupied' });
        }

        const event = slot.currentEvent;
        event.outTime = outTime;
        event.duration = calculateDuration(event.inTime, outTime);
        await event.save();

        // Clear the current event from the slot
        slot.currentEvent = null;
        await slot.save();

        res.status(200).json({ message: `Exit recorded for Slot ${slotId}`, event });
    } catch (err) {
        res.status(500).json({ message: 'Error recording exit', error: err.message });
    }
});

// Get all parking events
app.get('/events', async (req, res) => {
    try {
        const events = await ParkingEvent.find();
        res.status(200).json(events);
    } catch (err) {
        res.status(500).json({ message: 'Error retrieving parking events', error: err.message });
    }
});




// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
