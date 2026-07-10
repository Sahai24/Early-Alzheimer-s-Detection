// COGNITIVE & BIOMARKER MODEL COEFFICIENTS (From Logistic Regression on 10k Dataset)
const MODEL_CONFIG = {
    features: ['age', 'mmse', 'moca', 'ptau181_pgml', 'ptau217_pgml', 'ab42_ab40_ratio', 'nfl_pgml', 'gfap_pgml'],
    featureLabels: {
        'age': 'Patient Age',
        'mmse': 'MMSE Score',
        'moca': 'MoCA Score',
        'ptau181_pgml': 'p-tau181',
        'ptau217_pgml': 'p-tau217',
        'ab42_ab40_ratio': 'Aβ42/40 Ratio',
        'nfl_pgml': 'NfL Level',
        'gfap_pgml': 'GFAP Level'
    },
    mean: [69.8017, 25.2303, 22.8296, 3.1152, 0.3742, 0.0729, 23.2468, 175.8245],
    scale: [8.5418, 4.5711, 5.6532, 1.6863, 0.2268, 0.0225, 12.1084, 78.4163],
    intercept: [-3.0002, 6.5235, -3.5233],
    coefs: [
        // Class 0: Cognitively Normal (CN)
        [-0.8437, 3.763, 3.7232, -3.9919, -4.1603, 1.8312, -1.5705, -2.0837],
        // Class 1: Mild Cognitive Impairment (MCI)
        [0.0288, -0.5976, -0.535, 0.6337, 0.5592, 0.2448, 0.22, 0.122],
        // Class 2: Alzheimer's Disease (AD)
        [0.8149, -3.1654, -3.1882, 3.3582, 3.6011, -2.076, 1.3506, 1.9617]
    ]
};

// PRESET PROFILES
const PRESETS = {
    healthy: {
        age: 65,
        mmse: 29,
        moca: 28,
        ptau181_pgml: 1.8,
        ptau217_pgml: 0.15,
        ab42_ab40_ratio: 0.115,
        nfl_pgml: 12.0,
        gfap_pgml: 95
    },
    mci: {
        age: 72,
        mmse: 24,
        moca: 21,
        ptau181_pgml: 4.2,
        ptau217_pgml: 0.52,
        ab42_ab40_ratio: 0.065,
        nfl_pgml: 32.0,
        gfap_pgml: 220
    },
    ad: {
        age: 78,
        mmse: 16,
        moca: 14,
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
    loadPreset('healthy');
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

// MULTINOMIAL LOGISTIC REGRESSION DIAGNOSTICS & XAI EXPLANATIONS
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

    // 5. Determine predicted class
    const maxProb = Math.max(...probabilities);
    const predictedClass = probabilities.indexOf(maxProb);

    // 6. Update UI Gauges
    updateDiagnosisUI(predictedClass, probabilities);

    // 7. Calculate SHAP-style contributions for the predicted class
    calculateSHAP(predictedClass, scaledInputs);

    // 8. Generate diagnostic insights text
    generateInsights(predictedClass, inputs);
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
            <p>The patient's biomarker values and cognitive tests match the <strong>Cognitively Normal (CN)</strong> profile. 
            Both cognitive indicators (MMSE score of <strong>${inputs.mmse}</strong> and MoCA score of <strong>${inputs.moca}</strong>) are in the normal healthy range. 
            Important plasma indicators show no structural amyloid abnormalities, and neurofilament light (NfL) levels are normal, suggesting low brain cell degeneration.</p>
            <div class="insights-highlight-box">
                <strong>Standard Recommendation:</strong> Normal annual screenings and healthy dietary and cardiovascular maintenance.
            </div>
        `;
    } else if (predClass === 1) {
        // High-risk elements for MCI
        let reasons = [];
        if (inputs.mmse < 26 || inputs.moca < 24) {
            reasons.push("mild cognitive test scoring (MMSE/MoCA)");
        }
        if (inputs.ptau217_pgml > 0.4) {
            reasons.push("early elevated plasma p-tau217 indices");
        }
        if (inputs.ab42_ab40_ratio < 0.08) {
            reasons.push("a decreased Aβ42/40 ratio signifying early amyloid accumulation");
        }

        const reasonsStr = reasons.length > 0 ? reasons.join(', accompanied by ') : 'moderately anomalous fluid biomarkers';

        insightHtml = `
            <p>The system classifies this patient profile under <strong>Mild Cognitive Impairment (MCI)</strong>. 
            This is primarily driven by <strong>${reasonsStr}</strong>. 
            While patient function remains largely intact, the underlying biophysical indicators suggest early stage neurodegenerative pathophysiology is active.</p>
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
            The system indicates this is driven by **${bioStr}**, coupled with significant cognitive deficits (MMSE: <strong>${inputs.mmse}</strong>, MoCA: <strong>${inputs.moca}</strong>).</p>
            <div class="insights-highlight-box" style="border-left-color: var(--ad-color);">
                <strong>AD Protocol:</strong> Direct neurological consultation, CSF or PET scan imaging validation, and consideration for clinical management interventions.
            </div>
        `;
    }

    insightsTextContainer.innerHTML = insightHtml;
}
