// API Base URL
const API_BASE = '';

// Global state
let currentSettings = {
    dailyGoal: { amount: 2000, unit: 'ml' },
    preferredUnit: 'ml',
    reminderInterval: 60
};

let todayIntakes = [];
let isLoading = false;

// Utility functions
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

const formatAmount = (amount, unit) => {
    const formatted = unit === 'ml' ? Math.round(amount) : amount.toFixed(1);
    return `${formatted} ${unit}`;
};

const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
};

const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
};

// API functions
const api = {
    async get(endpoint) {
        const response = await fetch(`${API_BASE}/api${endpoint}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}/api${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    },

    async put(endpoint, data) {
        const response = await fetch(`${API_BASE}/api${endpoint}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    },

    async delete(endpoint) {
        const response = await fetch(`${API_BASE}/api${endpoint}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    }
};

// Loading functions
const showLoading = () => {
    document.getElementById('loadingOverlay').classList.remove('hide');
};

const hideLoading = () => {
    document.getElementById('loadingOverlay').classList.add('hide');
};

// Tab switching
const initTabs = () => {
    const tabButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            
            // Update active button
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Update active content
            tabContents.forEach(content => content.classList.remove('active'));
            document.getElementById(tabName).classList.add('active');
            
            // Load data for the active tab
            if (tabName === 'history') {
                loadHistoryData();
            }
        });
    });
};

// Settings modal
const initSettings = () => {
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const cancelSettings = document.getElementById('cancelSettings');
    const settingsForm = document.getElementById('settingsForm');

    const openModal = () => {
        // Populate form with current settings
        document.getElementById('dailyGoalAmount').value = currentSettings.dailyGoal.amount;
        document.getElementById('dailyGoalUnit').value = currentSettings.dailyGoal.unit;
        document.getElementById('preferredUnit').value = currentSettings.preferredUnit;
        
        settingsModal.classList.add('show');
    };

    const closeModal = () => {
        settingsModal.classList.remove('show');
    };

    settingsBtn.addEventListener('click', openModal);
    closeSettings.addEventListener('click', closeModal);
    cancelSettings.addEventListener('click', closeModal);

    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) closeModal();
    });

    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newSettings = {
            dailyGoal: {
                amount: parseFloat(document.getElementById('dailyGoalAmount').value),
                unit: document.getElementById('dailyGoalUnit').value
            },
            preferredUnit: document.getElementById('preferredUnit').value
        };

        try {
            await api.put('/settings', newSettings);
            currentSettings = { ...currentSettings, ...newSettings };
            closeModal();
            await loadDashboardData();
            updateQuickButtons();
        } catch (error) {
            console.error('Error updating settings:', error);
            alert('Failed to update settings. Please try again.');
        }
    });
};

// Add water form
const initAddWaterForm = () => {
    const form = document.getElementById('addWaterForm');
    const amountInput = document.getElementById('waterAmount');
    const unitSelect = document.getElementById('waterUnit');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = parseFloat(amountInput.value);
        const unit = unitSelect.value;

        if (amount <= 0) return;

        try {
            await api.post('/water', { amount, unit });
            amountInput.value = '';
            await loadDashboardData();
        } catch (error) {
            console.error('Error adding water intake:', error);
            alert('Failed to add water intake. Please try again.');
        }
    });

    // Update unit select when preferred unit changes
    unitSelect.value = currentSettings.preferredUnit;
};

// Quick add buttons
const updateQuickButtons = () => {
    const quickButtons = document.getElementById('quickButtons');
    const unit = currentSettings.preferredUnit;
    
    const quickAmounts = {
        ml: [250, 500, 750, 1000],
        L: [0.25, 0.5, 0.75, 1],
        oz: [8, 16, 24, 32],
        cups: [1, 2, 3, 4]
    };

    quickButtons.innerHTML = '';
    
    quickAmounts[unit].forEach(amount => {
        const button = document.createElement('button');
        button.className = 'quick-btn';
        button.textContent = `${amount} ${unit}`;
        button.addEventListener('click', async () => {
            try {
                await api.post('/water', { amount, unit });
                await loadDashboardData();
            } catch (error) {
                console.error('Error adding quick water intake:', error);
                alert('Failed to add water intake. Please try again.');
            }
        });
        quickButtons.appendChild(button);
    });
};

// Dashboard updates
const updateProgressBar = (progress, totalIntake, goal, unit) => {
    const progressFill = document.getElementById('progressFill');
    const progressPercentage = document.getElementById('progressPercentage');
    const progressAmount = document.getElementById('progressAmount');
    const progressMessage = document.getElementById('progressMessage');
    const goalIndicator = document.getElementById('goalIndicator');

    const displayTotal = convertFromMl(totalIntake, unit);
    const clampedProgress = Math.min(progress, 100);

    progressFill.style.width = `${clampedProgress}%`;
    progressPercentage.textContent = `${Math.round(progress)}%`;
    progressAmount.textContent = `${Math.round(displayTotal)} / ${goal} ${unit}`;

    if (progress >= 100) {
        progressMessage.textContent = 'Goal reached! Great job!';
        progressMessage.className = 'progress-message success';
        goalIndicator.classList.add('show');
       
    } else {
        const remaining = goal - displayTotal;
        progressMessage.textContent = `${Math.round(remaining)} ${unit} to go`;
        progressMessage.className = 'progress-message';
        goalIndicator.classList.remove('show');
    }
};

const updateStats = async () => {
    try {
        const [dailyStats, streakData] = await Promise.all([
            api.get('/stats/daily'),
            api.get('/stats/streak')
        ]);

        document.getElementById('streakValue').textContent = streakData.streak;
        document.getElementById('goalValue').textContent = `${currentSettings.dailyGoal.amount} ${currentSettings.dailyGoal.unit}`;
        document.getElementById('intakeCount').textContent = dailyStats.intakeCount;
        document.getElementById('progressStat').textContent = `${Math.round(dailyStats.progress)}%`;
    } catch (error) {
        console.error('Error updating stats:', error);
    }
};

const updateRecentIntakes = () => {
    const recentIntakes = document.getElementById('recentIntakes');
    
    if (todayIntakes.length === 0) {
        recentIntakes.innerHTML = '<p class="no-intakes">No water intake recorded today</p>';
        return;
    }

    const sortedIntakes = [...todayIntakes].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );

    recentIntakes.innerHTML = sortedIntakes.map(intake => `
        <div class="intake-item">
            <div class="intake-info">
                <div class="intake-dot"></div>
                <div>
                    <span class="intake-amount">${formatAmount(intake.amount, intake.unit)}</span>
                    <span class="intake-time">${formatTime(intake.timestamp)}</span>
                </div>
            </div>
            <button class="delete-btn" onclick="deleteIntake('${intake._id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6v14a2,2 0,0,1-2,2H7a2,2,0,0,1-2-2V6m3,0V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2v2"/>
                </svg>
            </button>
        </div>
    `).join('');
};

// Delete intake function
const deleteIntake = async (id) => {
    try {
        await api.delete(`/water/${id}`);
        await loadDashboardData();
    } catch (error) {
        console.error('Error deleting intake:', error);
        alert('Failed to delete intake. Please try again.');
    }
};

// Make deleteIntake globally available
window.deleteIntake = deleteIntake;

// Load dashboard data
const loadDashboardData = async () => {
    try {
        const [intakes, dailyStats] = await Promise.all([
            api.get('/water/today'),
            api.get('/stats/daily')
        ]);

        todayIntakes = intakes;
        
        updateProgressBar(
            dailyStats.progress,
            dailyStats.totalIntake,
            currentSettings.dailyGoal.amount,
            currentSettings.dailyGoal.unit
        );
        
        updateRecentIntakes();
        await updateStats();
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
};

// History functions
const loadHistoryData = async () => {
    try {
        const [historyIntakes, settings] = await Promise.all([
            api.get('/water/history?days=7'),
            api.get('/settings')
        ]);

        updateWeeklyOverview(historyIntakes, settings);
        updateDailyHistory(historyIntakes, settings);
    } catch (error) {
        console.error('Error loading history data:', error);
    }
};

const updateWeeklyOverview = (intakes, settings) => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }

    const weeklyData = last7Days.map(date => {
        const dayIntakes = intakes.filter(intake => intake.date === date);
        const totalIntakeMl = dayIntakes.reduce((sum, intake) => 
            sum + convertToMl(intake.amount, intake.unit), 0);
        
        const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
        const progress = Math.min((totalIntakeMl / goalMl) * 100, 100);
        
        return {
            date,
            progress,
            totalIntake: convertFromMl(totalIntakeMl, settings.dailyGoal.unit),
            dayName: new Date(date).toLocaleDateString('en-US', { weekday: 'short' })
        };
    });

    const averageIntake = weeklyData.reduce((sum, day) => sum + day.totalIntake, 0) / 7;
    const daysCompleted = weeklyData.filter(day => day.progress >= 100).length;
    const totalWeekly = weeklyData.reduce((sum, day) => sum + day.totalIntake, 0);

    // Update weekly stats
    document.getElementById('weeklyStats').innerHTML = `
        <div class="weekly-stat">
            <div class="weekly-stat-value blue">${daysCompleted}</div>
            <div class="weekly-stat-label">Days Completed</div>
        </div>
        <div class="weekly-stat">
            <div class="weekly-stat-value green">${Math.round(averageIntake)}</div>
            <div class="weekly-stat-label">Avg ${settings.dailyGoal.unit}/day</div>
        </div>
        <div class="weekly-stat">
            <div class="weekly-stat-value purple">${Math.round((daysCompleted / 7) * 100)}%</div>
            <div class="weekly-stat-label">Success Rate</div>
        </div>
        <div class="weekly-stat">
            <div class="weekly-stat-value orange">${Math.round(totalWeekly)}</div>
            <div class="weekly-stat-label">Total ${settings.dailyGoal.unit}</div>
        </div>
    `;

    // Update weekly chart
    document.getElementById('weeklyChart').innerHTML = weeklyData.map(day => `
        <div class="chart-day">
            <div class="chart-day-name">${day.dayName}</div>
            <div class="chart-bar-container">
                <div class="chart-bar">
                    <div class="chart-bar-fill" style="width: ${Math.min(day.progress, 100)}%"></div>
                </div>
                <div class="chart-percentage">${Math.round(day.progress)}%</div>
            </div>
            <div class="chart-amount">${Math.round(day.totalIntake)} ${settings.dailyGoal.unit}</div>
        </div>
    `).join('');
};

const updateDailyHistory = (intakes, settings) => {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        last7Days.push(date.toISOString().split('T')[0]);
    }

    const dailyData = last7Days.reverse().map(date => {
        const dayIntakes = intakes.filter(intake => intake.date === date);
        const totalIntakeMl = dayIntakes.reduce((sum, intake) => 
            sum + convertToMl(intake.amount, intake.unit), 0);
        
        const goalMl = convertToMl(settings.dailyGoal.amount, settings.dailyGoal.unit);
        const progress = Math.min((totalIntakeMl / goalMl) * 100, 100);
        
        return {
            date,
            progress,
            totalIntake: convertFromMl(totalIntakeMl, settings.dailyGoal.unit),
            goalReached: progress >= 100
        };
    });

    document.getElementById('dailyHistory').innerHTML = dailyData.map(day => `
        <div class="history-day">
            <div class="history-day-header">
                <div>
                    <div class="history-day-date">
                        ${new Date(day.date).toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'short', 
                            day: 'numeric' 
                        })}
                    </div>
                    <div class="history-day-amount">
                        ${Math.round(day.totalIntake)} ${settings.dailyGoal.unit} consumed
                    </div>
                </div>
                <div class="history-day-progress">
                    <div class="history-day-percentage ${day.goalReached ? 'success' : 'progress'}">
                        ${Math.round(day.progress)}%
                    </div>
                    ${day.goalReached ? '<div class="history-day-status">✓ Goal reached</div>' : ''}
                </div>
            </div>
        </div>
    `).join('');
};

// Initialize app
const initApp = async () => {
    showLoading();
    
    try {
        // Load settings
        currentSettings = await api.get('/settings');
        
        // Initialize components
        initTabs();
        initSettings();
        initAddWaterForm();
        updateQuickButtons();
        
        // Load initial data
        await loadDashboardData();
        
        hideLoading();
    } catch (error) {
        console.error('Error initializing app:', error);
        hideLoading();
        alert('Failed to load the application. Please refresh the page.');
    }
};

// Start the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);