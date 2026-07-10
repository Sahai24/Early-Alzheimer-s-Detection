# Early Alzheimer's Detection

An explainable machine-learning pipeline for early Alzheimer's Disease (AD) screening using blood-based biomarkers, demographic/lifestyle data, and cognitive assessment scores — paired with **AuraMind**, an interactive browser-based diagnostic demo.

> ⚠️ **Academic project — not a medical device.** This project is trained entirely on a synthetically generated dataset and is intended for research/educational purposes only. It must not be used for real clinical decision-making.

## Overview

Alzheimer's Disease is typically diagnosed only after significant, often irreversible, neurodegeneration has occurred, and confirmatory diagnostics (MRI/PET, CSF analysis) are expensive and invasive. This project explores whether a low-cost blood-biomarker panel — combined with demographic, metabolic, and cognitive-assessment data — can support **early, explainable, three-way classification** between:

- **CN** — Cognitively Normal
- **MCI** — Mild Cognitive Impairment
- **AD** — Alzheimer's Disease

An [XGBoost](https://xgboost.readthedocs.io/) classifier is trained on a 10,000-patient synthetic dataset, and every prediction is paired with a ranked, SHAP-style breakdown of the biomarkers that drove it — so results are interpretable rather than a black box.

## Repository Structure

```
Early-Alzheimer-s-Detection/
├── alzheimers_synthetic_10k.csv   # 10,000-patient synthetic dataset (51 columns)
├── main.ipynb                     # Data validation, EDA, model training & evaluation
├── frontend/
│   ├── index.html                 # AuraMind UI — biomarker input & diagnosis panels
│   ├── styles.css                 # Styling
│   └── app.js                     # Client-side prediction + SHAP-style explanation logic
└── .gitignore
```

## Dataset

`alzheimers_synthetic_10k.csv` contains 10,000 synthetic patient records across 51 columns, statistically modelled on distributions reported in the plasma-biomarker literature. No missing values or duplicate rows are present. Feature groups include:

| Category | Example features |
|---|---|
| Demographics & lifestyle | `age`, `sex`, `education_years`, `bmi`, `smoking_history`, `physical_activity`, `family_history_ad`, `apoe4_alleles` |
| Core AD blood biomarkers | `ab42_pgml`, `ab40_pgml`, `ab42_ab40_ratio`, `ptau181_pgml`, `ptau217_pgml`, `ttau_pgml`, `nfl_pgml`, `gfap_pgml` |
| Synaptic / neurodegeneration markers | `snap25_pgml`, `syt1_ngml`, `vilip1_pgml`, `ykl40_pgml`, `trem2_pgml` |
| Inflammatory & metabolic/vascular panel | `il6_pgml`, `tnfa_pgml`, `crp_mgL`, `clusterin_ugml`, `homocysteine_umol`, `glucose_mgdl`, `hba1c_pct`, lipid panel, `insulin_uUml`, `cortisol_nmol`, `bdnf_ngml`, `igf1_ngml` |
| Cognitive assessment | `mmse` (0–30), `moca` (0–30), `cdr` (0/0.5/1/2) |
| Target | `diagnosis` (CN/MCI/AD), `diagnosis_code` (0/1/2) |

## Model

- **Algorithm:** `XGBClassifier` (`objective='multi:softprob'`, `num_class=3`, `eval_metric='mlogloss'`, `enable_categorical=True`)
- **Split:** Stratified 80/20 train-test split (`random_state=42`)
- **Test accuracy:** 99.85% (1,997 / 2,000 correctly classified), precision/recall/F1 ≈ 1.00 across all three classes

**⚠️ Known limitation — target leakage:** Feature-importance analysis shows `cdr` (Clinical Dementia Rating) alone accounts for ~68% of the model's decision-making, followed by `ptau217_pgml` (~9%), `moca` (~8%), and `mmse` (~3%). Because CDR is itself a clinical staging score closely tied to the diagnosis label, this inflates the reported accuracy. A biomarker-only variant (excluding `cdr`/`moca`/`mmse`) is needed to get an honest read on how well blood biomarkers alone predict diagnosis — see [Future Work](#future-work).

## AuraMind — Interactive Demo UI

`frontend/` contains a dependency-free HTML/CSS/JS interface that lets you:

- Adjust biomarker, demographic, and cognitive-score inputs
- Load quick presets for **Cognitively Normal**, **MCI**, and **Alzheimer's** profiles
- View the predicted class and per-class probabilities
- View a ranked, SHAP-style bar chart of the top contributing features

> Note: the front end currently **simulates** inference client-side in JavaScript rather than calling the trained XGBoost model from `main.ipynb` through a live API — see Future Work.

## Getting Started

### 1. Train / explore the model

```bash
pip install pandas numpy matplotlib seaborn xgboost scikit-learn
jupyter notebook main.ipynb
```

Run the notebook top to bottom to reproduce data validation, training, evaluation (accuracy, classification report, confusion matrix), and the feature-importance chart.

### 2. Run the AuraMind demo UI

No build step required — just open it in a browser:

```bash
cd frontend
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Tech Stack

- **Modelling:** Python, pandas, NumPy, scikit-learn, XGBoost, Matplotlib/Seaborn
- **Frontend:** HTML5, CSS3, vanilla JavaScript (no framework)

## Future Work

- Expose the trained XGBoost model via a lightweight REST API (e.g., FastAPI) so AuraMind calls the real model instead of a client-side approximation
- Retrain on a biomarker-only feature set (excluding CDR/MoCA/MMSE) to measure genuine blood-biomarker predictive power
- Benchmark against Logistic Regression, Random Forest, and deep-learning baselines with proper cross-validation and hyperparameter tuning
- Integrate true [SHAP](https://github.com/slundberg/shap) values instead of the current simplified client-side approximation
- Validate against a real, ethically-sourced, de-identified clinical dataset

## References

- Lundberg, S. M., & Lee, S.-I. (2017). *A Unified Approach to Interpreting Model Predictions.* NeurIPS.
- [XGBoost Documentation](https://xgboost.readthedocs.io/)
- [scikit-learn Documentation](https://scikit-learn.org/)

## Author

**Avanish Sahai** — MCA, School of Computer Applications, Dayananda Sagar University
**Harsh CHaudhary** - MCA, School of Computer Applications, Dayananda Sagar University
**Madhav P** - MCA, School of Computer Applications, Dayananda Sagar University
