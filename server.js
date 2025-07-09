import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import 'dotenv/config';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/watertracker');
    console.log('Connected to MongoDB');
    return true;
  } catch (err) {
    console.warn('MongoDB connection failed:', err.message);
    console.warn('Running in development mode without database persistence');
    return false;
  }
};

let isMongoConnected = false;
connectToMongoDB().then(connected => {
  isMongoConnected = connected;
});

let memoryStorage = {
  waterIntakes: [],
  settings: {
    dailyGoal: { amount: 2000, unit: 'ml' },
    preferredUnit: 'ml',
    reminderInterval: 60
  }
};

const waterIntakeSchema = new mongoose.Schema({
  amount: { type: Number, required: true },
  unit: { type: String, required: true, enum: ['ml', 'L', 'oz', 'cups'] },
  timestamp: { type: Date, default: Date.now },
  date: { type: String, required: true } 
});

const settingsSchema = new mongoose.Schema({
  dailyGoal: {
    amount: { type: Number, default: 2000 },
    unit: { type: String, default: 'ml', enum: ['ml', 'L', 'oz', 'cups'] }
  },
  preferredUnit: { type: String, default: 'ml', enum: ['ml', 'L', 'oz', 'cups'] },
  reminderInterval: { type: Number, default: 60 }
});

const WaterIntake = mongoose.model('WaterIntake', waterIntakeSchema);
const Settings = mongoose.model('Settings', settingsSchema);

const convertToMl = (amount, unit) => {
  switch (unit) {
    case 'L': return amount * 1000;
    case 'oz': return amount * 29.5735;
    case 'cups': return amount * 236.588;
    default: return amount;
  }
};

const convertFromMl = (amount, unit) => {
  switch (unit) {
    case 'L': return amount / 1000;
    case 'oz': return amount / 29.5735;
    case 'cups': return amount / 236.588;
    default: return amount;
  }
};

const getTodayDate = () => {
  return new Date().toISOString().split('T')[0];
};


app.get('/api/water/today', async (req, res) => {
  try {
    if (isMongoConnected) {
      const today = getTodayDate();
      const intakes = await WaterIntake.find({ date: today }).sort({ timestamp: -1 });
      res.json(intakes);
    } else {
      const today = getTodayDate();
      const intakes = memoryStorage.waterIntakes
        .filter(intake => intake.date === today)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      res.json(intakes);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/water/history', async (req, res) => {
  try {
    if (isMongoConnected) {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      
      const intakes = await WaterIntake.find({
        date: { $gte: startDate.toISOString().split('T')[0] }
      }).sort({ timestamp: -1 });
      
      res.json(intakes);
    } else {
      const { days = 7 } = req.query;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      const startDateStr = startDate.toISOString().split('T')[0];
      
      const intakes = memoryStorage.waterIntakes
        .filter(intake => intake.date >= startDateStr)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      
      res.json(intakes);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/water', async (req, res) => {
  try {
    if (isMongoConnected) {
      const { amount, unit } = req.body;
      const intake = new WaterIntake({
        amount,
        unit,
        date: getTodayDate()
      });
      
      await intake.save();
      res.status(201).json(intake);
    } else {
      const { amount, unit } = req.body;
      const intake = {
        _id: Date.now().toString(),
        amount,
        unit,
        timestamp: new Date(),
        date: getTodayDate()
      };
      
      memoryStorage.waterIntakes.push(intake);
      res.status(201).json(intake);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/water/:id', async (req, res) => {
  try {
    if (isMongoConnected) {
      await WaterIntake.findByIdAndDelete(req.params.id);
      res.status(204).send();
    } else {
      const index = memoryStorage.waterIntakes.findIndex(intake => intake._id === req.params.id);
      if (index > -1) {
        memoryStorage.waterIntakes.splice(index, 1);
      }
      res.status(204).send();
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    if (isMongoConnected) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings();
        await settings.save();
      }
      res.json(settings);
    } else {
      res.json(memoryStorage.settings);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    if (isMongoConnected) {
      let settings = await Settings.findOne();
      if (!settings) {
        settings = new Settings();
      }
      
      Object.assign(settings, req.body);
      await settings.save();
      res.json(settings);
    } else {
      Object.assign(memoryStorage.settings, req.body);
      res.json(memoryStorage.settings);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/stats/daily', async (req, res) => {
  try {
    if (isMongoConnected) {
      const { date = getTodayDate() } = req.query;
      const intakes = await WaterIntake.find({ date });
      const settings = await Settings.findOne() || new Settings();
      
      const totalIntakeMl = intakes.reduce((sum, intake) => 
        sum + convertToMl(intake.amount, intake.unit), 0);
      
      const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
      const progress = Math.min((totalIntakeMl / goalMl) * 100, 100);
      
      res.json({
        date,
        totalIntake: totalIntakeMl,
        progress,
        goalReached: progress >= 100,
        intakeCount: intakes.length
      });
    } else {
      const { date = getTodayDate() } = req.query;
      const intakes = memoryStorage.waterIntakes.filter(intake => intake.date === date);
      const settings = memoryStorage.settings;
      
      const totalIntakeMl = intakes.reduce((sum, intake) => 
        sum + convertToMl(intake.amount, intake.unit), 0);
      
      const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
      const progress = Math.min((totalIntakeMl / goalMl) * 100, 100);
      
      res.json({
        date,
        totalIntake: totalIntakeMl,
        progress,
        goalReached: progress >= 100,
        intakeCount: intakes.length
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/stats/streak', async (req, res) => {
  try {
    if (isMongoConnected) {
      const settings = await Settings.findOne() || new Settings();
      const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
      
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const intakes = await WaterIntake.find({ date: dateStr });
        const totalIntakeMl = intakes.reduce((sum, intake) => 
          sum + convertToMl(intake.amount, intake.unit), 0);
        
        const progress = (totalIntakeMl / goalMl) * 100;
        
        if (progress >= 100) {
          streak++;
        } else {
          break;
        }
      }
      
      res.json({ streak });
    } else {
      const settings = memoryStorage.settings;
      const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
      
      let streak = 0;
      const today = new Date();
      
      for (let i = 0; i < 365; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toISOString().split('T')[0];
        
        const intakes = memoryStorage.waterIntakes.filter(intake => intake.date === dateStr);
        const totalIntakeMl = intakes.reduce((sum, intake) => 
          sum + convertToMl(intake.amount, intake.unit), 0);
        
        const progress = (totalIntakeMl / goalMl) * 100;
        
        if (progress >= 100) {
          streak++;
        } else {
          break;
        }
      }
      
      res.json({ streak });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


