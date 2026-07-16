// COGNITIVE & BIOMARKER MODEL COEFFICIENTS (From Logistic Regression on 10k Dataset)
const MODEL_CONFIG = {
    features: ['ptau181_pgml', 'ptau217_pgml', 'ab42_ab40_ratio', 'nfl_pgml', 'gfap_pgml'],
    featureLabels: {
        'ptau181_pgml': 'p-tau181',
        'ptau217_pgml': 'p-tau217',
        'ab42_ab40_ratio': 'Aβ42/40 Ratio',
        'nfl_pgml': 'NfL Level',
        'gfap_pgml': 'GFAP Level'
    },
    mean: [3.1152, 0.3742, 0.0729, 23.2468, 175.8245],
    scale: [1.6863, 0.2268, 0.0225, 12.1084, 78.4163],
    intercept: [-1.707, 4.923, -3.216],
    coefs: [
        // Class 0: Cognitively Normal (CN)
        [-4.3439, -5.1361, 2.3464, -2.0113, -2.3511],
        // Class 1: Mild Cognitive Impairment (MCI)
        [0.5182, 0.7301, 0.1096, 0.2128, 0.2233],
        // Class 2: Alzheimer's Disease (AD)
        [3.8257, 4.406, -2.456, 1.7984, 2.1278]
    ]
};

// PRESET PROFILES
const PRESETS = {
    healthy: {
        ptau181_pgml: 1.8,
        ptau217_pgml: 0.15,
        ab42_ab40_ratio: 0.115,
        nfl_pgml: 12.0,
        gfap_pgml: 95
    },
    mci: {
        ptau181_pgml: 4.2,
        ptau217_pgml: 0.52,
        ab42_ab40_ratio: 0.065,
        nfl_pgml: 32.0,
        gfap_pgml: 220
    },
    ad: {
        ptau181_pgml: 7.8,
        ptau217_pgml: 0.98,
        ab42_ab40_ratio: 0.035,
        nfl_pgml: 54.0,
        gfap_pgml: 380
    }
};

// DOM ELEMENTS
const biomarkerForm = document.getElementById('biomarker-form');
const processingCard = document.getElementById('processing-card');
const resultsCard = document.getElementById('results-card');
const xaiCard = document.getElementById('xai-card');
const insightsCard = document.getElementById('insights-card');

const progressBar = document.getElementById('diagnostic-progress-bar');
const processingStep = document.getElementById('processing-step');

// Gauge elements
const gaugeFillCircle = document.getElementById('gauge-fill-circle');
const mainPercentage = document.getElementById('main-percentage');
const classTitlePrimary = document.getElementById('class-title-primary');
const classBadgeDescription = document.getElementById('class-badge-description');

const probCnText = document.getElementById('prob-cn-text');
const probCnFill = document.getElementById('prob-cn-fill');
const probMciText = document.getElementById('prob-mci-text');
const probMciFill = document.getElementById('prob-mci-fill');
const probAdText = document.getElementById('prob-ad-text');
const probAdFill = document.getElementById('prob-ad-fill');

const xaiBarsContainer = document.getElementById('xai-bars-container');
const insightsTextContainer = document.getElementById('insights-text-container');

// INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    setupSlidersAndInputs();
    setupPresetButtons();
    setupTabSwitching();
    setupThresholdControl();
    setupLogRegistry();
    initCharts(); // Initialize Chart.js objects
    loadPreset('healthy');
    renderLogs(); // Draw any saved localStorage log data
});

// Setup 2-way data binding between range sliders and numeric input boxes
function setupSlidersAndInputs() {
    MODEL_CONFIG.features.forEach(feature => {
        const slider = document.getElementById(feature);
        const inputNum = document.getElementById(`${feature}-num`);

        if (slider && inputNum) {
            // Initialize slider value
            inputNum.value = slider.value;

            // Slider input event -> Update numeric box & run calculation
            slider.addEventListener('input', (e) => {
                inputNum.value = e.target.value;
                triggerRecalculation();
            });

            // Numeric input box change event -> Update slider & run calculation
            inputNum.addEventListener('change', (e) => {
                let val = parseFloat(e.target.value);
                const min = parseFloat(slider.min);
                const max = parseFloat(slider.max);

                // Clamp values to slider boundaries
                if (isNaN(val)) val = min;
                if (val < min) val = min;
                if (val > max) val = max;

                e.target.value = val;
                slider.value = val;
                triggerRecalculation();
            });
        }
    });
}

function setupPresetButtons() {
    ['healthy', 'mci', 'ad'].forEach(preset => {
        const btn = document.getElementById(`btn-preset-${preset}`);
        if (btn) {
            btn.addEventListener('click', () => {
                // Toggle active class
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Load values
                loadPreset(preset);
            });
        }
    });
}

function loadPreset(presetName) {
    const data = PRESETS[presetName];
    if (data) {
        MODEL_CONFIG.features.forEach(feature => {
            const slider = document.getElementById(feature);
            const inputNum = document.getElementById(`${feature}-num`);
            if (slider && inputNum) {
                slider.value = data[feature];
                inputNum.value = data[feature];
            }
        });
        triggerRecalculation();
    }
}

// Recalculation Debouncer/Loader trigger
let recalculationTimeout;
function triggerRecalculation() {
    clearTimeout(recalculationTimeout);

    // Show visual processing loader
    processingCard.style.display = 'block';
    resultsCard.classList.add('opacity-low');
    xaiCard.classList.add('opacity-low');
    insightsCard.classList.add('opacity-low');

    // Run simulated steps for the Progress Bar (User Requested)
    animateProgressBar(0, 'Standardizing patient biomarkers...', () => {
        animateProgressBar(35, 'Computing multinomial probability tensor...', () => {
            animateProgressBar(70, 'Running SHAP explanation calculations...', () => {
                animateProgressBar(100, 'Analysis complete.', () => {
                    // Hide loader and execute model math
                    processingCard.style.display = 'none';
                    resultsCard.classList.remove('opacity-low');
                    xaiCard.classList.remove('opacity-low');
                    insightsCard.classList.remove('opacity-low');

                    calculateDiagnostics();
                });
            });
        });
    });
}

// Progress bar stepping function
function animateProgressBar(percent, statusMessage, callback) {
    setTimeout(() => {
        progressBar.style.width = `${percent}%`;
        processingStep.textContent = statusMessage;
        if (callback) callback();
    }, 180);
}

function calculateDiagnostics() {
    // 1. Ingest inputs
    const inputs = {};
    MODEL_CONFIG.features.forEach(feature => {
        inputs[feature] = parseFloat(document.getElementById(feature).value);
    });

    // 2. Standardize inputs (scaling)
    const scaledInputs = {};
    for (let i = 0; i < MODEL_CONFIG.features.length; i++) {
        const feat = MODEL_CONFIG.features[i];
        scaledInputs[feat] = (inputs[feat] - MODEL_CONFIG.mean[i]) / MODEL_CONFIG.scale[i];
    }

    // 3. Compute raw scores (log-odds) for each class
    const scores = [];
    for (let i = 0; i < 3; i++) {
        let score = MODEL_CONFIG.intercept[i];
        for (let j = 0; j < MODEL_CONFIG.features.length; j++) {
            const feat = MODEL_CONFIG.features[j];
            score += MODEL_CONFIG.coefs[i][j] * scaledInputs[feat];
        }
        scores.push(score);
    }

    // 4. Softmax probability activation
    const expScores = scores.map(s => Math.exp(s));
    const sumExp = expScores.reduce((a, b) => a + b, 0);
    const probabilities = expScores.map(e => e / sumExp);

    // 5. Determine predicted class based on custom threshold
    const thresholdSlider = document.getElementById('risk-threshold');
    const thresholdPercent = thresholdSlider ? parseFloat(thresholdSlider.value) : 50;
    const thresholdVal = thresholdPercent / 100;

    // Update visual text indicator for threshold
    const thresholdValSpan = document.getElementById('threshold-val');
    if (thresholdValSpan) {
        thresholdValSpan.textContent = `${thresholdPercent}%`;
    }

    // Custom threshold classification logic:
    // If Alzheimer's (AD) prob is >= threshold -> classify as AD (Class 2)
    // Else if MCI + AD combined prob is >= threshold -> classify as MCI (Class 1)
    // Else -> classify as Cognitively Normal (Class 0)
    let predictedClass = 0;
    if (probabilities[2] >= thresholdVal) {
        predictedClass = 2; // AD
    } else if (probabilities[1] + probabilities[2] >= thresholdVal) {
        predictedClass = 1; // MCI
    } else {
        predictedClass = 0; // CN
    }

    // 6. Update UI Gauges
    updateDiagnosisUI(predictedClass, probabilities);

    // 7. Calculate SHAP-style contributions for the predicted class
    calculateSHAP(predictedClass, scaledInputs);

    // 8. Generate diagnostic insights text
    generateInsights(predictedClass, inputs);

    // 9. Update the analytical dashboard charts
    updateCharts(inputs, probabilities);
}

function updateDiagnosisUI(predClass, probs) {
    const cnProb = Math.round(probs[0] * 100);
    const mciProb = Math.round(probs[1] * 100);
    const adProb = Math.round(probs[2] * 100);
    const confidence = Math.round(probs[predClass] * 100);

    // Radial Circle updates
    mainPercentage.textContent = `${confidence}%`;
    const offset = 314.16 - (314.16 * confidence) / 100;
    gaugeFillCircle.style.strokeDashoffset = offset;

    // Color code circle path by category
    let colorClass, title, badge;
    if (predClass === 0) {
        colorClass = 'var(--healthy-color)';
        title = 'Cognitively Normal';
        badge = 'Consistent with baseline cognitive control profiles.';
    } else if (predClass === 1) {
        colorClass = 'var(--mci-color)';
        title = 'Mild Cognitive Impairment (MCI)';
        badge = 'Early cognitive decline indicators present. Follow-up is recommended.';
    } else {
        colorClass = 'var(--ad-color)';
        title = "Alzheimer's Disease (AD) Risk";
        badge = 'Significant cognitive depletion and high-risk biomarker indices.';
    }

    gaugeFillCircle.style.stroke = colorClass;
    mainPercentage.style.color = colorClass;
    classTitlePrimary.textContent = title;
    classTitlePrimary.style.color = colorClass;
    classBadgeDescription.textContent = badge;

    // Numerical probability bar updates
    probCnText.textContent = `${cnProb}%`;
    probCnFill.style.width = `${cnProb}%`;
    probMciText.textContent = `${mciProb}%`;
    probMciFill.style.width = `${mciProb}%`;
    probAdText.textContent = `${adProb}%`;
    probAdFill.style.width = `${adProb}%`;
}

function calculateSHAP(predClass, scaledInputs) {
    xaiBarsContainer.innerHTML = '';

    // Calculate raw contributions for each feature: Coef * ScaledValue
    const contributions = MODEL_CONFIG.features.map((feat, idx) => {
        const raw = MODEL_CONFIG.coefs[predClass][idx] * scaledInputs[feat];
        return { feature: feat, val: raw };
    });

    // Find max magnitude to dynamically scale the bars in CSS
    const maxVal = Math.max(...contributions.map(c => Math.abs(c.val)));

    contributions.forEach(contrib => {
        const label = MODEL_CONFIG.featureLabels[contrib.feature];
        const rawVal = contrib.val;

        // Scale width to fit in layout (max 45% left or right of the zero-line)
        const percentWidth = maxVal > 0 ? (Math.abs(rawVal) / maxVal) * 40 : 0;
        const formattedVal = (rawVal > 0 ? '+' : '') + rawVal.toFixed(2);

        const row = document.createElement('div');
        row.className = 'xai-bar-row';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'xai-bar-label';
        labelSpan.textContent = label;
        row.appendChild(labelSpan);

        const trackWrapper = document.createElement('div');
        trackWrapper.className = 'xai-bar-track-wrapper';

        const zeroLine = document.createElement('div');
        zeroLine.className = 'xai-zero-line';
        trackWrapper.appendChild(zeroLine);

        const bar = document.createElement('div');

        if (rawVal >= 0) {
            bar.className = 'shap-bar positive';
            bar.style.left = '50%';
            bar.style.width = `${percentWidth}%`;
        } else {
            bar.className = 'shap-bar negative';
            bar.style.right = '50%';
            bar.style.width = `${percentWidth}%`;
        }

        const valueTag = document.createElement('span');
        valueTag.className = 'shap-value-tag';
        valueTag.textContent = formattedVal;
        bar.appendChild(valueTag);

        trackWrapper.appendChild(bar);
        row.appendChild(trackWrapper);
        xaiBarsContainer.appendChild(row);
    });

    // Add Axis Legend below
    const legend = document.createElement('div');
    legend.className = 'xai-axis-legend';
    legend.innerHTML = '<span>◀ Pushes Toward Normal</span><span>Pushes Toward Risk ▶</span>';
    xaiBarsContainer.appendChild(legend);
}

function generateInsights(predClass, inputs) {
    let insightHtml = '';

    if (predClass === 0) {
        insightHtml = `
            <p>The patient's plasma biomarker values match the <strong>Cognitively Normal (CN)</strong> profile. 
            Core plasma indicators show no structural amyloid abnormalities (Aβ42/40 ratio is normal), and phosphorylated tau (p-tau217/p-tau181) levels are within baseline limits. 
            Neurofilament light (NfL) and GFAP levels are normal, suggesting no active axonal damage or neuroinflammation.</p>
            <div class="insights-highlight-box">
                <strong>Standard Recommendation:</strong> Normal annual screenings and healthy dietary and cardiovascular maintenance.
            </div>
        `;
    } else if (predClass === 1) {
        // High-risk elements for MCI
        let reasons = [];
        if (inputs.ptau217_pgml > 0.4) {
            reasons.push("early elevated plasma p-tau217 indices");
        }
        if (inputs.ab42_ab40_ratio < 0.08) {
            reasons.push("a decreased Aβ42/40 ratio signifying early amyloid accumulation");
        }
        if (inputs.nfl_pgml > 28.0) {
            reasons.push("moderate neurofilament light (NfL) elevations indicating early axonal injury");
        }

        const reasonsStr = reasons.length > 0 ? reasons.join(', accompanied by ') : 'moderately anomalous fluid biomarkers';

        insightHtml = `
            <p>The system classifies this patient profile under <strong>Mild Cognitive Impairment (MCI)</strong>. 
            This is primarily driven by <strong>${reasonsStr}</strong>. 
            The underlying biophysical indicators suggest early stage neurodegenerative pathophysiology is active.</p>
            <div class="insights-highlight-box" style="border-left-color: var(--mci-color);">
                <strong>MCI Protocol:</strong> Referral to a specialist for neurocognitive assessment, MRI imaging, and regular longitudinal monitoring.
            </div>
        `;
    } else {
        // High-risk elements for AD
        let biomarkersList = [];
        if (inputs.ptau217_pgml > 0.6) biomarkersList.push("highly elevated p-tau217");
        if (inputs.ab42_ab40_ratio < 0.06) biomarkersList.push("critical Aβ42/40 ratio depletion");
        if (inputs.gfap_pgml > 220) biomarkersList.push("reactive astrogliosis (high GFAP)");
        if (inputs.nfl_pgml > 35) biomarkersList.push("active axonal damage (high NfL)");

        const bioStr = biomarkersList.length > 0 ? biomarkersList.join(', ') : 'highly abnormal biomarker values';

        insightHtml = `
            <p>The patient profile shows a strong alignment with **Alzheimer's Disease (AD) Risk**. 
            The system indicates this is driven by **${bioStr}**, signifying advanced amyloid plaque deposition and severe neurofibrillary tau tangles.</p>
            <div class="insights-highlight-box" style="border-left-color: var(--ad-color);">
                <strong>AD Protocol:</strong> Direct neurological consultation, CSF or PET scan imaging validation, and consideration for clinical management interventions.
            </div>
        `;
    }

    insightsTextContainer.innerHTML = insightHtml;
}

// ==========================================
// TAB SWITCHING LOGIC
// ==========================================
function setupTabSwitching() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Remove active classes
            tabButtons.forEach(b => b.classList.remove('active'));
            tabPanels.forEach(p => p.classList.remove('active'));

            // Add active classes
            btn.classList.add('active');
            const targetPanel = document.getElementById(`tab-${targetTab}`);
            if (targetPanel) {
                targetPanel.classList.add('active');
            }

            // Force Chart.js updates on visibility changes
            if (targetTab === 'dashboard') {
                if (radarChartInstance) radarChartInstance.resize();
                if (scatterChartInstance) scatterChartInstance.resize();
                if (importanceChartInstance) importanceChartInstance.resize();
            }
        });
    });
}

// ==========================================
// THRESHOLD SLIDER LOGIC
// ==========================================
function setupThresholdControl() {
    const thresholdSlider = document.getElementById('risk-threshold');
    const thresholdValSpan = document.getElementById('threshold-val');

    if (thresholdSlider && thresholdValSpan) {
        thresholdSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            thresholdValSpan.textContent = `${val}%`;
            triggerRecalculation();
        });
    }
}

// ==========================================
// LOG REGISTRY LOGIC
// ==========================================
let assessmentLogs = [];

function setupLogRegistry() {
    // Fetch logs from the backend database on load
    fetchLogsFromServer();

    const btnSave = document.getElementById('btn-save-log');
    const btnSaveConsole = document.getElementById('btn-save-log-console');
    const btnClear = document.getElementById('btn-clear-logs');
    const btnExport = document.getElementById('btn-export-csv');

    if (btnSave) {
        btnSave.addEventListener('click', saveCurrentAssessmentLog);
    }
    if (btnSaveConsole) {
        btnSaveConsole.addEventListener('click', saveCurrentAssessmentLog);
    }
    if (btnClear) {
        btnClear.addEventListener('click', clearLogs);
    }
    if (btnExport) {
        btnExport.addEventListener('click', exportLogsToCSV);
    }
}

function fetchLogsFromServer() {
    fetch('/api/logs')
        .then(response => {
            if (!response.ok) throw new Error('Database response error');
            return response.json();
        })
        .then(data => {
            assessmentLogs = data;
            renderLogs();
        })
        .catch(err => {
            console.error('Error fetching logs from database:', err);
            assessmentLogs = [];
            renderLogs();
        });
}

function saveCurrentAssessmentLog() {
    // Collect current values
    const ptau181 = parseFloat(document.getElementById('ptau181_pgml').value);
    const ptau217 = parseFloat(document.getElementById('ptau217_pgml').value);
    const ab42_ab40_ratio = parseFloat(document.getElementById('ab42_ab40_ratio').value);
    const nfl = parseFloat(document.getElementById('nfl_pgml').value);
    const gfap = parseFloat(document.getElementById('gfap_pgml').value);

    const thresholdSlider = document.getElementById('risk-threshold');
    const threshold = thresholdSlider ? thresholdSlider.value : 50;

    const diagnosisText = document.getElementById('class-title-primary').textContent;
    const confidenceText = document.getElementById('main-percentage').textContent;

    const logEntry = {
        timestamp: new Date().toLocaleString(),
        ptau181,
        ptau217,
        ab42_ab40_ratio,
        nfl,
        gfap,
        threshold: `${threshold}%`,
        diagnosis: diagnosisText,
        confidence: confidenceText
    };

    // Save to server database
    fetch('/api/logs', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(logEntry)
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to save to database');
            return response.json();
        })
        .then(() => {
            // Refresh logs from database
            fetchLogsFromServer();

            // Show visual confirmation on the buttons
            const btnSave = document.getElementById('btn-save-log');
            if (btnSave) {
                const originalText = btnSave.innerHTML;
                btnSave.innerHTML = '✅ Saved to Database!';
                btnSave.classList.add('text-accent');
                setTimeout(() => {
                    btnSave.innerHTML = originalText;
                    btnSave.classList.remove('text-accent');
                }, 1500);
            }

            const btnSaveConsole = document.getElementById('btn-save-log-console');
            if (btnSaveConsole) {
                const originalText = btnSaveConsole.innerHTML;
                btnSaveConsole.innerHTML = '✅ Assessment Saved to Database!';
                btnSaveConsole.style.background = 'rgba(16, 185, 129, 0.2)';
                btnSaveConsole.style.borderColor = 'var(--healthy-color)';
                btnSaveConsole.style.color = 'var(--healthy-color)';
                setTimeout(() => {
                    btnSaveConsole.innerHTML = originalText;
                    btnSaveConsole.style.background = '';
                    btnSaveConsole.style.borderColor = '';
                    btnSaveConsole.style.color = '';
                }, 1500);
            }
        })
        .catch(err => {
            console.error('Error saving log to database:', err);
            alert('Error saving assessment to database. Please check connection.');
        });
}

function renderLogs() {
    const tableBody = document.getElementById('log-table-body');
    if (!tableBody) return;

    if (assessmentLogs.length === 0) {
        tableBody.innerHTML = '<tr id="no-logs-row"><td colspan="9" class="text-center">No assessments saved. Perform a test and click "Save Diagnostic Run" to log it.</td></tr>';
        return;
    }

    tableBody.innerHTML = '';
    assessmentLogs.forEach(log => {
        const row = document.createElement('tr');

        // Color badge for diagnosis
        let badgeClass = 'badge-cn';
        if (log.diagnosis.includes('AD') || log.diagnosis.includes('Alzheimer')) {
            badgeClass = 'badge-ad';
        } else if (log.diagnosis.includes('MCI') || log.diagnosis.includes('Mild')) {
            badgeClass = 'badge-mci';
        }

        row.innerHTML = `
            <td>${log.timestamp}</td>
            <td>${log.ptau181 ? log.ptau181.toFixed(1) : '0.0'} pg/mL</td>
            <td>${log.ptau217.toFixed(2)} pg/mL</td>
            <td>${log.ab42_ab40_ratio.toFixed(3)}</td>
            <td>${log.nfl.toFixed(1)} pg/mL</td>
            <td>${log.gfap.toFixed(0)} pg/mL</td>
            <td>${log.threshold}</td>
            <td><span class="${badgeClass}">${log.diagnosis}</span></td>
            <td><strong>${log.confidence}</strong></td>
        `;
        tableBody.appendChild(row);
    });
}

function clearLogs() {
    if (confirm('Are you sure you want to clear your entire screening history from the database?')) {
        fetch('/api/logs', {
            method: 'DELETE'
        })
            .then(response => {
                if (!response.ok) throw new Error('Failed to clear database logs');
                return response.json();
            })
            .then(() => {
                assessmentLogs = [];
                renderLogs();
            })
            .catch(err => {
                console.error('Error clearing database logs:', err);
                alert('Could not clear logs database. Please check connection.');
            });
    }
}

function exportLogsToCSV() {
    if (assessmentLogs.length === 0) {
        alert('No logged diagnostic sessions to export.');
        return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Timestamp,p-tau181,p-tau217,Abeta42/40 Ratio,NfL Level,GFAP Level,Sensitivity Threshold,Predicted Diagnosis,Model Confidence\n";

    assessmentLogs.forEach(log => {
        const diag = `"${log.diagnosis.replace(/"/g, '""')}"`;
        const row = [
            `"${log.timestamp}"`,
            log.ptau181 || 0.0,
            log.ptau217,
            log.ab42_ab40_ratio,
            log.nfl,
            log.gfap,
            `"${log.threshold}"`,
            diag,
            `"${log.confidence}"`
        ].join(",");
        csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Alzheimers_Diagnostic_Screening_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); // Required for FF
    link.click();
    document.body.removeChild(link);
}

// ==========================================
// CHART.JS INTEGRATION LOGIC
// ==========================================
let radarChartInstance = null;
let scatterChartInstance = null;
let importanceChartInstance = null;

function initCharts() {
    // 1. Radar Chart Initialization
    const radarCtx = document.getElementById('radarChart');
    if (radarCtx) {
        radarChartInstance = new Chart(radarCtx, {
            type: 'radar',
            data: {
                labels: ['p-tau181', 'p-tau217', 'Aβ42/40 Ratio', 'NfL Level', 'GFAP Level'],
                datasets: [
                    {
                        label: 'Normal Clinical Baseline',
                        data: [0.15, 0.1, 0.15, 0.1, 0.1],
                        borderColor: 'rgba(16, 185, 129, 0.4)',
                        backgroundColor: 'rgba(16, 185, 129, 0.04)',
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    {
                        label: 'MCI Clinical Baseline',
                        data: [0.4, 0.5, 0.45, 0.4, 0.4],
                        borderColor: 'rgba(245, 158, 11, 0.4)',
                        backgroundColor: 'rgba(245, 158, 11, 0.04)',
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    {
                        label: 'Alzheimer\'s Baseline',
                        data: [0.85, 0.85, 0.8, 0.75, 0.75],
                        borderColor: 'rgba(239, 68, 68, 0.4)',
                        backgroundColor: 'rgba(239, 68, 68, 0.04)',
                        borderWidth: 2,
                        pointRadius: 0
                    },
                    {
                        label: 'Current Patient',
                        data: [0, 0, 0, 0, 0],
                        borderColor: '#00f2fe',
                        backgroundColor: 'rgba(0, 242, 254, 0.25)',
                        borderWidth: 3,
                        pointBackgroundColor: '#00f2fe',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: '#00f2fe',
                        pointRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { display: false, maxTicksLimit: 5 },
                        pointLabels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                        suggestedMin: 0,
                        suggestedMax: 1
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#f1f5f9', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    }
                }
            }
        });
    }

    // 2. Population Scatter Chart Initialization
    const scatterCtx = document.getElementById('scatterChart');
    if (scatterCtx) {
        // Pre-bake reference cohort clusters
        const cnCluster = [
            { x: 0.1, y: 0.12 }, { x: 0.15, y: 0.10 }, { x: 0.08, y: 0.14 }, { x: 0.2, y: 0.11 }, { x: 0.12, y: 0.13 },
            { x: 0.18, y: 0.095 }, { x: 0.22, y: 0.115 }, { x: 0.14, y: 0.125 }, { x: 0.11, y: 0.135 }, { x: 0.16, y: 0.105 },
            { x: 0.24, y: 0.09 }, { x: 0.07, y: 0.15 }, { x: 0.19, y: 0.122 }, { x: 0.13, y: 0.118 }, { x: 0.09, y: 0.138 }
        ];
        const mciCluster = [
            { x: 0.35, y: 0.085 }, { x: 0.42, y: 0.075 }, { x: 0.5, y: 0.068 }, { x: 0.38, y: 0.092 }, { x: 0.48, y: 0.07 },
            { x: 0.55, y: 0.062 }, { x: 0.32, y: 0.088 }, { x: 0.45, y: 0.08 }, { x: 0.52, y: 0.074 }, { x: 0.4, y: 0.078 },
            { x: 0.36, y: 0.082 }, { x: 0.44, y: 0.072 }, { x: 0.49, y: 0.065 }, { x: 0.58, y: 0.058 }, { x: 0.31, y: 0.095 }
        ];
        const adCluster = [
            { x: 0.8, y: 0.045 }, { x: 0.95, y: 0.035 }, { x: 1.1, y: 0.025 }, { x: 0.75, y: 0.052 }, { x: 0.88, y: 0.04 },
            { x: 1.05, y: 0.03 }, { x: 1.2, y: 0.022 }, { x: 0.7, y: 0.058 }, { x: 0.85, y: 0.048 }, { x: 1.0, y: 0.038 },
            { x: 0.83, y: 0.042 }, { x: 0.92, y: 0.032 }, { x: 1.15, y: 0.026 }, { x: 1.3, y: 0.018 }, { x: 0.78, y: 0.048 }
        ];

        scatterChartInstance = new Chart(scatterCtx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'Normal Patients',
                        data: cnCluster,
                        backgroundColor: 'rgba(16, 185, 129, 0.4)',
                        pointRadius: 4
                    },
                    {
                        label: 'MCI Patients',
                        data: mciCluster,
                        backgroundColor: 'rgba(245, 158, 11, 0.4)',
                        pointRadius: 4
                    },
                    {
                        label: 'Alzheimer\'s Patients',
                        data: adCluster,
                        backgroundColor: 'rgba(239, 68, 68, 0.4)',
                        pointRadius: 4
                    },
                    {
                        label: 'Current Patient',
                        data: [{ x: 0, y: 0 }],
                        backgroundColor: '#00f2fe',
                        borderColor: '#ffffff',
                        borderWidth: 2,
                        pointRadius: 10,
                        pointStyle: 'rectRot',
                        showLine: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        title: { display: true, text: 'p-tau217 Level (pg/mL)', color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    },
                    y: {
                        title: { display: true, text: 'Aβ42/Aβ40 Ratio', color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { color: '#f1f5f9', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    }
                }
            }
        });
    }

    // 3. Feature Importance Horizontal Bar Chart
    const importanceCtx = document.getElementById('importanceChart');
    if (importanceCtx) {
        importanceChartInstance = new Chart(importanceCtx, {
            type: 'bar',
            data: {
                labels: ['NfL Level', 'GFAP Level', 'Aβ42/40 Ratio', 'p-tau181', 'p-tau217'],
                datasets: [{
                    label: 'Feature Importance Weight (%)',
                    data: [4.42, 4.70, 4.89, 39.59, 46.39],
                    backgroundColor: 'rgba(0, 242, 254, 0.3)',
                    borderColor: 'rgba(0, 242, 254, 0.7)',
                    borderWidth: 1.5,
                    borderRadius: 6
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans', size: 9 } }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: '#f1f5f9', font: { family: 'Plus Jakarta Sans', size: 10 } }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
}

function updateCharts(inputs, probabilities) {
    if (radarChartInstance) {
        // Scale each current patient input to a 0-1 range for the radar chart
        const patientScaled = [
            minMaxScale('ptau181_pgml', inputs.ptau181_pgml),
            minMaxScale('ptau217_pgml', inputs.ptau217_pgml),
            minMaxScale('ab42_ab40_ratio', inputs.ab42_ab40_ratio),
            minMaxScale('nfl_pgml', inputs.nfl_pgml),
            minMaxScale('gfap_pgml', inputs.gfap_pgml)
        ];

        radarChartInstance.data.datasets[3].data = patientScaled;
        radarChartInstance.update();
    }

    if (scatterChartInstance) {
        // Plot the current patient dot dynamically in real time
        // x-axis: ptau217, y-axis: ab42_ab40_ratio
        scatterChartInstance.data.datasets[3].data = [{
            x: inputs.ptau217_pgml,
            y: inputs.ab42_ab40_ratio
        }];

        // Dynamically change dot outline color based on the predicted category
        let dotColor = 'var(--healthy-color)';
        const maxIndex = probabilities.indexOf(Math.max(...probabilities));
        if (maxIndex === 1) dotColor = 'var(--mci-color)';
        if (maxIndex === 2) dotColor = 'var(--ad-color)';

        scatterChartInstance.data.datasets[3].backgroundColor = dotColor;
        scatterChartInstance.update();
    }
}

function minMaxScale(feature, val) {
    const slider = document.getElementById(feature);
    if (!slider) return 0;
    const min = parseFloat(slider.min);
    const max = parseFloat(slider.max);

    let score;
    // Aβ42/40 ratio decreases with pathology.
    // Invert it so a higher value on the radar chart means a worse/more abnormal state.
    if (feature === 'ab42_ab40_ratio') {
        score = (max - val) / (max - min);
    } else {
        score = (val - min) / (max - min);
    }
    return Math.max(0.02, Math.min(1.0, score)); // clamp between 0.02 and 1
}

