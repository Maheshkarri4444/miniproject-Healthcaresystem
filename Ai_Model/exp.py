import pandas as pd
import numpy as np
import os
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
import joblib
from rapidfuzz import process, fuzz
import warnings

# Suppress warnings
warnings.filterwarnings("ignore", category=UserWarning, module="sklearn")

# Directory Configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODELS_DIR, exist_ok=True)

# Dataset Paths
DATA_PATHS = {
    'symptoms': os.path.join(BASE_DIR, "Data.csv"),
    'clinical': os.path.join(BASE_DIR, "clinic.csv"),
    'environmental': os.path.join(BASE_DIR, "env.csv")
}

# Environmental mappings
ENV_MAPPINGS = {
    'temperature': {'low': 1, 'medium': 2, 'high': 3, None: 2},
    'humidity': {'low': 1, 'medium': 2, 'high': 3, None: 2},
    'air_quality': {'bad': 4, 'normal': 5, 'good': 6, None: 5},
    'water_quality': {'bad': 4, 'normal': 5, 'good': 6, None: 5},
    'region_type': {
        'mountain': 7, 'desert': 8, 'forest': 9, 'grassland': 10,
        'cold': 11, 'coastal': 12, 'river_basin': 13, 'tropical': 14,
        'temperate': 15, 'dry': 16, 'urban': 17, 'rural': 18, None: 18
    },
    'weather': {
        'sunny': 19, 'cloudy': 20, 'rainy': 21, 'snowy': 22,
        'windy': 23, 'foggy': 24, 'stormy': 25, 'sweaty': 26, 'humid': 27, None: 19
    },
    'time_delay': {
        'recent': (28, 1.0),
        '<5days': (28, 1.0),
        '28': (28, 1.0),
        'moderate': (29, 1.3),
        '5to15days': (29, 1.3),
        '29': (29, 1.3),
        'long': (30, 1.7),
        '>15days': (30, 1.7),
        '30': (30, 1.7),
        None: (29, 1.0)
    }
}

def load_data_safely(file_path, dataset_type):
    try:
        dtype_map = {
            'symptoms': {col: 'int8' for col in pd.read_csv(file_path, nrows=1).columns if col != 'Diseases'},
            'clinical': {
                'Age': 'int8', 'Weight': 'int16', 'BP': 'int16',
                'Sugar': 'int16', 'Cholesterol': 'int16',
                'WBC': 'int16', 'BMI': 'float32', 'Sleep': 'int8',
                'Diseases': 'object'
            },
            'environmental': {
                'Diseases': 'object',
                'temperature': 'object',
                'humidity': 'object',
                'air_quality': 'object',
                'water_quality': 'object',
                'region_type': 'object',
                'weather': 'object',
                'time_delay': 'object'
            }
        }

        df = pd.read_csv(file_path, dtype=dtype_map.get(dataset_type, None),
                         na_values=['', 'NA', 'N/A', 'NaN', 'null'])

        col_rename = {
            'Bp': 'BP', 'Cholestral': 'Cholesterol', 'Sleep Duration': 'Sleep',
            'Temperature': 'temperature', 'Weather': 'weather',
            'Region_Type': 'region_type', 'Air_Quality': 'air_quality',
            'Water_Quality': 'water_quality', 'Humidity': 'humidity'
        }
        df = df.rename(columns={k: v for k, v in col_rename.items() if k in df.columns})

        initial_count = len(df)
        df = df.dropna()
        if len(df) < initial_count:
            print(f"Dropped {initial_count - len(df)} rows with missing values from {os.path.basename(file_path)}")

        return df
    except Exception as e:
        print(f"Error loading {os.path.basename(file_path)}: {str(e)}")
        return None

def train_and_save_models():
    try:
        print("Loading datasets...")
        df_symptoms = load_data_safely(DATA_PATHS['symptoms'], 'symptoms')
        df_clinical = load_data_safely(DATA_PATHS['clinical'], 'clinical')
        df_env = load_data_safely(DATA_PATHS['environmental'], 'environmental')

        if any(df is None for df in [df_symptoms, df_clinical, df_env]):
            return False

        le = LabelEncoder()
        all_diseases = pd.concat([
            df_symptoms['Diseases'],
            df_clinical['Diseases'],
            df_env['Diseases']
        ]).unique()
        le.fit(all_diseases)

        print("\nTraining Symptom Model...")
        X_symp = df_symptoms.drop('Diseases', axis=1)
        y_symp = le.transform(df_symptoms['Diseases'])
        xgb_model = XGBClassifier(
            objective='multi:softprob',
            num_class=len(le.classes_),
            tree_method='hist',
            n_estimators=100,
            max_depth=5,
            learning_rate=0.1,
            n_jobs=-1,
            random_state=42
        )
        xgb_model.fit(X_symp, y_symp)

        print("\nTraining Clinical Model...")
        clinical_cols = ['Age', 'Weight', 'BP', 'Sugar', 'Cholesterol', 'WBC', 'BMI', 'Sleep']
        X_clin = df_clinical[clinical_cols]
        y_clin = le.transform(df_clinical['Diseases'])
        clin_scaler = StandardScaler()
        X_clin_scaled = clin_scaler.fit_transform(X_clin)
        lr_clin = LogisticRegression(
            class_weight='balanced',
            max_iter=1000,
            n_jobs=-1,
            random_state=42
        )
        lr_clin.fit(X_clin_scaled, y_clin)

        print("\nTraining Environmental Model...")
        env_cols = list(ENV_MAPPINGS.keys())
        X_env = df_env[env_cols]
        y_env = le.transform(df_env['Diseases'])
        rf_env = RandomForestClassifier(
            n_estimators=50,
            max_depth=5,
            class_weight='balanced',
            n_jobs=-1,
            random_state=42
        )
        rf_env.fit(X_env, y_env)

        print("\n✨ All models trained successfully! ✨")
        print("\n✨ Saving models... ✨")

        joblib.dump(xgb_model, os.path.join(MODELS_DIR, 'xgb_model.pkl'))
        joblib.dump(lr_clin, os.path.join(MODELS_DIR, 'clinical_model.pkl'))
        joblib.dump(rf_env, os.path.join(MODELS_DIR, 'env_model.pkl'))
        joblib.dump(le, os.path.join(MODELS_DIR, 'disease_encoder.pkl'))
        joblib.dump(X_symp.columns.tolist(), os.path.join(MODELS_DIR, 'symptom_features.pkl'))
        joblib.dump(clinical_cols, os.path.join(MODELS_DIR, 'clinical_features.pkl'))
        joblib.dump(env_cols, os.path.join(MODELS_DIR, 'env_features.pkl'))
        joblib.dump(clin_scaler, os.path.join(MODELS_DIR, 'clinical_scaler.pkl'))
        joblib.dump(df_symptoms, os.path.join(MODELS_DIR, 'symptom_data.pkl'))

        return True
    except Exception as e:
        print(f"\nTraining failed: {str(e)}")
        return False
    
def match_symptoms_with_rapidfuzz(input_symptoms, symptom_cols):
    # Preprocess symptom columns: replace underscores with spaces
    symptom_cols_normalized = [col.lower().replace('_', ' ') for col in symptom_cols]
    
    # Process input: normalize, replace hyphens, and split on commas
    input_symptoms = str(input_symptoms).strip().lower().replace('_', ' ').replace('-', ' ')
    symptom_terms = [term.strip() for term in input_symptoms.split(',') if term.strip()]
    
    symptom_vector = pd.DataFrame(0, index=[0], columns=symptom_cols)
    matched_symptoms = []
    unmatched_symptoms = []
    symptom_matches = 0
    used_terms = set()
    
    for term in symptom_terms:
        if term in used_terms:
            continue
            
        # Split term into words, handle run-on terms
        words = [w for w in term.split() if w]
        if len(term.replace(' ', '')) >= 6 and not words:  # Handle run-on like 'mildfever'
            if term.startswith('mild'):
                words = ['mild', term[4:]]
            else:
                words = [term[:len(term)//2], term[len(term)//2:]]
                # Additional splits for fever-like terms
                if 'fever' in term or 'fevr' in term or 'fver' in term:
                    words = ['mild', 'fever']
        candidates = [term, term.replace(' ', '')]
        for i in range(len(words)):
            for j in range(i + 1, min(i + 3, len(words) + 1)):
                candidate = ' '.join(words[i:j])
                candidates.append(candidate)
        candidates.append(words[0] if words else term)
        
        best_match = None
        best_score = 0
        best_col = None
        best_input = None
        matched = False
        
        for candidate in candidates:
            # Exact match
            if candidate in symptom_cols_normalized:
                idx = symptom_cols_normalized.index(candidate)
                matched_col = symptom_cols[idx]
                symptom_vector[matched_col] = 1
                symptom_matches += 1
                matched_symptoms.append((term, matched_col, 100))
                used_terms.add(term)
                matched = True
                break
            
            # Fuzzy match with lowered thresholds
            match_token = process.extractOne(
                candidate,
                symptom_cols_normalized,
                scorer=fuzz.token_sort_ratio,
                score_cutoff=65
            )
            match_partial = process.extractOne(
                candidate,
                symptom_cols_normalized,
                scorer=fuzz.partial_ratio,
                score_cutoff=70
            )
            match_qratio = process.extractOne(
                candidate,
                symptom_cols_normalized,
                scorer=fuzz.QRatio,
                score_cutoff=65
            )
            
            # Combine scores: prioritize token_sort_ratio for multi-word
            weight_token = 0.6 if ' ' in candidate else 0.5
            weight_partial = 0.2 if ' ' in candidate else 0.2
            weight_qratio = 0.2 if ' ' in candidate else 0.3
            matches = [(match_token, weight_token), (match_partial, weight_partial), (match_qratio, weight_qratio)]
            for match, weight in matches:
                if match and match[1] * weight > best_score:
                    best_score = match[1] * weight
                    best_match = match[0]
                    best_col = symptom_cols[symptom_cols_normalized.index(best_match)]
                    best_input = candidate
        
        if best_match and best_col and best_input and not matched and best_score >= 55 * 0.5:
            symptom_vector[best_col] = 1
            symptom_matches += 1
            matched_symptoms.append((term, best_col, best_score / 0.5))
            used_terms.add(term)
        elif not matched:
            unmatched_symptoms.append(term)
    
    return symptom_vector, symptom_matches, matched_symptoms, unmatched_symptoms

def predict_disease(symptoms, clinical_data, env_data, models):
    (xgb_model, lr_clin, rf_env, le, symptom_cols, clinical_cols, env_cols, clin_scaler, df_symptoms) = models

    # Process symptoms
    try:
        symptom_vector, symptom_matches, matched_symptoms, unmatched_symptoms = match_symptoms_with_rapidfuzz(symptoms, symptom_cols)
        matched_symptom_cols = symptom_vector.columns[symptom_vector.iloc[0] == 1].tolist()
    except Exception as e:
        raise ValueError(f"Symptom processing error: {str(e)}")

    # Calculate symptom specificity (IDF-like weighting)
    symptom_weights = {}
    for col in symptom_cols:
        disease_count = len(df_symptoms[df_symptoms[col] == 1]['Diseases'].unique())
        total_diseases = len(le.classes_)
        symptom_weights[col] = np.log(total_diseases / max(disease_count, 1)) * 3 + 1 if disease_count > 0 else 1

    # Calculate symptom co-occurrence score
    co_occurrence_scores = {}
    for disease in le.classes_:
        disease_rows = df_symptoms[df_symptoms['Diseases'] == disease]
        if not disease_rows.empty:
            disease_symptoms = disease_rows[symptom_cols].mean() >= 0.5
            disease_cols = disease_symptoms[disease_symptoms].index.tolist()
            matches = set(matched_symptom_cols) & set(disease_cols)
            if len(matches) >= 2:
                co_occurrence = sum(
                    1 for _, row in disease_rows.iterrows()
                    if all(row[col] == 1 for col in matches)
                )
                co_occurrence_scores[disease] = co_occurrence / max(len(disease_rows), 1) * 2
            else:
                co_occurrence_scores[disease] = 0
        else:
            co_occurrence_scores[disease] = 0

    # Adjust symptom vector
    weighted_symptom_vector = symptom_vector.copy()
    for col in matched_symptom_cols:
        weighted_symptom_vector[col] *= symptom_weights.get(col, 1)

    # Get model predictions
    try:
        xgb_probs = xgb_model.predict_proba(weighted_symptom_vector)[0] * 0.65
        clin_probs = lr_clin.predict_proba(
            clin_scaler.transform(pd.DataFrame([clinical_data], columns=clinical_cols))
        )[0] * 0.18
        env_probs = rf_env.predict_proba(
            pd.DataFrame([env_data], columns=env_cols)
        )[0] * 0.17
        combined_probs = xgb_probs + clin_probs + env_probs
    except Exception as e:
        raise ValueError(f"Prediction error: {str(e)}")

    # Calculate severity score
    clinical_factors = {
        'bmi': 1.3 if clinical_data['BMI'] < 18.5 or clinical_data['BMI'] > 30 else 1.0,
        'bp': 1.2 if clinical_data['BP'] > 140 or clinical_data['BP'] < 90 else 1.0,
        'sugar': 1.2 if clinical_data['Sugar'] > 140 else 1.0,
        'cholesterol': 1.2 if clinical_data['Cholesterol'] > 200 else 1.0,
        'wbc': 1.2 if clinical_data['WBC'] > 11 or clinical_data['WBC'] < 4 else 1.0,
        'sleep': 1.2 if clinical_data['Sleep'] < 5 or clinical_data['Sleep'] > 9 else 1.0,
        'age': 1.1 if clinical_data['Age'] > 60 or clinical_data['Age'] < 12 else 1.0
    }
    clinical_score = np.prod(list(clinical_factors.values()))

    env_factors = {
        'water': 1.4 if env_data['water_quality'] == 4 else (0.9 if env_data['water_quality'] == 6 else 1.0),
        'air': 1.2 if env_data['air_quality'] == 4 else (0.9 if env_data['air_quality'] == 6 else 1.0),
        'temp': 1.2 if env_data['temperature'] == 3 else (0.9 if env_data['temperature'] == 1 else 1.0),
        'humidity': 1.2 if env_data['humidity'] == 3 else 1.0,
        'region': (
            1.4 if env_data['region_type'] in [14, 13] else
            1.3 if env_data['region_type'] in [12, 9, 10] else
            1.1 if env_data['region_type'] in [11, 16] else
            1.0
        ),
        'time': ENV_MAPPINGS['time_delay'][str(env_data['time_delay'])][1]
    }
    env_score = np.prod(list(env_factors.values()))

    severity_score = clinical_score * env_score * (1 + symptom_matches / 4)
    severity_score = min(severity_score, 3.5)

    # Prioritize diseases
    disease_matches = []
    matched_symptoms_per_disease = {}
    symptom_specificity_scores = {}
    for i, disease in enumerate(le.classes_):
        disease_rows = df_symptoms[df_symptoms['Diseases'] == disease]
        if not disease_rows.empty:
            disease_symptoms = disease_rows[symptom_cols].mean() >= 0.5
            disease_symptom_cols = disease_symptoms[disease_symptoms].index.tolist()
            matched_to_disease = len(set(matched_symptom_cols) & set(disease_symptom_cols))
            matched_symptoms_per_disease[disease] = list(set(matched_symptom_cols) & set(disease_symptom_cols))
            specificity = sum(symptom_weights.get(col, 1) for col in matched_symptoms_per_disease[disease])
            symptom_specificity_scores[disease] = specificity
        else:
            matched_to_disease = 0
            matched_symptoms_per_disease[disease] = []
            symptom_specificity_scores[disease] = 0
        disease_matches.append(matched_to_disease)

    # Define unlikely diseases
    unlikely_diseases = ['Hypertension', 'Diabetes', 'Tuberculosis', 'Hepatitis D', 'Cancer', 'Lymphoma', 'GERD']
    required_symptoms = {
        'Hypertension': ['high_blood_pressure', 'dizziness'],
        'Diabetes': ['increased_thirst', 'frequent_urination'],
        'Tuberculosis': ['weight_loss', 'night_sweats', 'blood_in_sputum'],
        'Hepatitis D': ['jaundice', 'dark_urine'],
        'Cancer': ['unexplained_weight_loss', 'lump'],
        'Lymphoma': ['swollen_lymph_nodes'], 
        'GERD': ['heartburn', 'chest_pain']
    }

    # Prevalence adjustment for common diseases
    prevalence_weights = {d: 1.5 if d in ['Common Cold', 'Influenza', 'Allergies'] else 1.0 for d in le.classes_}

    # Adjust probabilities
    max_matches = max(disease_matches) if disease_matches else 1
    match_weights = np.array([10 * m / max_matches + 1 for m in disease_matches])  # Reduced weighting
    specificity_weights = np.array([1 + 3 * s / max(symptom_specificity_scores.values() or [1]) for s in symptom_specificity_scores.values()])
    co_occurrence_weights = np.array([1 + c for c in co_occurrence_scores.values()])
    prevalence_weights_array = np.array([prevalence_weights[d] for d in le.classes_])
    
    adjusted_probs = combined_probs * match_weights * specificity_weights * co_occurrence_weights * prevalence_weights_array * severity_score
    for i, disease in enumerate(le.classes_):
        if disease in unlikely_diseases:
            if not any(sym in matched_symptom_cols for sym in required_symptoms.get(disease, [])):
                adjusted_probs[i] *= 0.05
    
    adjusted_probs = adjusted_probs / np.sum(adjusted_probs) if adjusted_probs.sum() > 0 else combined_probs

    # Get top 3 diseases
    top_diseases = []
    for i in np.argsort(adjusted_probs)[-5:][::-1]:
        disease = le.classes_[i]
        matched_to_disease = disease_matches[i]
        matched_names = matched_symptoms_per_disease[disease]

        risk_percentage = min(0.7, adjusted_probs[i] * severity_score) * 100  # Lower cap
        if matched_to_disease < 2:
            risk_percentage = min(risk_percentage, 20.0)
        elif matched_to_disease == 2:
            risk_percentage = min(risk_percentage, 40.0)
        if i == np.argmax(adjusted_probs) and matched_to_disease >= 3:
            risk_percentage = min(risk_percentage * 1.5, 70.0)

        top_diseases.append({
            'disease': disease,
            'risk_percentage': float(risk_percentage),
            'input_symptoms_identified': [col.replace('_', ' ') for _, col, _ in matched_symptoms],
            'symptoms_matched_to_disease': matched_to_disease,
            'matched_symptom_names': matched_names,
            'severity_factor': float(severity_score),
            'warning': "Consider clinical evaluation" if risk_percentage > 50 else None
        })

    # Sort and filter
    top_diseases = sorted(
        top_diseases,
        key=lambda x: (x['symptoms_matched_to_disease'], x['risk_percentage']),
        reverse=True
    )
    filtered_diseases = [d for d in top_diseases if d['symptoms_matched_to_disease'] > 0]
    top_diseases = filtered_diseases[:3] if len(filtered_diseases) >= 3 else filtered_diseases + top_diseases[:3-len(filtered_diseases)]

    if not top_diseases:
        top_diseases = sorted(
            [{'disease': le.classes_[i], 
              'risk_percentage': float(min(0.7, adjusted_probs[i] * severity_score) * 100),
              'input_symptoms_identified': [col.replace('_', ' ') for _, col, _ in matched_symptoms],
              'symptoms_matched_to_disease': 0, 'matched_symptom_names': [],
              'severity_factor': float(severity_score), 'warning': None}
             for i in np.argsort(adjusted_probs)[-3:][::-1]],
            key=lambda x: x['risk_percentage'],
            reverse=True
        )

    return top_diseases, matched_symptoms, unmatched_symptoms

def get_clinical_input():
    print("\n=== Clinical Data Input ===")
    print("Please enter values within these ranges:")
    input_ranges = {
        'Age': (1, 100, "years"),
        'Weight': (30, 150, "kg"),
        'BP': (60, 200, "mmHg (systolic)"),
        'Sugar': (50, 300, "mg/dL (fasting)"),
        'Cholesterol': (10, 300, "mg/dL"),
        'WBC': (2, 20, "thousands/μL"),
        'BMI': (5, 30, ""),
        'Sleep': (0, 10, "hours")
    }

    clinical_data = {}
    for param, (min_val, max_val, unit) in input_ranges.items():
        while True:
            try:
                prompt = f"{param} ({min_val}-{max_val} {unit}): "
                value = float(input(prompt))
                if value < min_val or value > max_val:
                    print(f"Error: {param} must be between {min_val}-{max_val} {unit}")
                    continue
                clinical_data[param] = value
                break
            except ValueError:
                print("Invalid input. Please enter a number")
    return clinical_data

def get_environmental_input():
    print("\n=== Environmental Data Input ===")
    env_data = {}

    while True:
        temp = input("Temperature (low/medium/high): ").lower()
        if temp in ['low', 'medium', 'high']:
            env_data['temperature'] = ENV_MAPPINGS['temperature'][temp]
            break
        print("Please enter low, medium, or high")

    while True:
        humid = input("Humidity (low/medium/high): ").lower()
        if humid in ['low', 'medium', 'high']:
            env_data['humidity'] = ENV_MAPPINGS['humidity'][humid]
            break
        print("Please enter low, medium, or high")

    while True:
        air = input("Air Quality (bad/normal/good): ").lower()
        if air in ['bad', 'normal', 'good']:
            env_data['air_quality'] = ENV_MAPPINGS['air_quality'][air]
            break
        print("Please enter bad, normal, or good")

    while True:
        water = input("Water Quality (bad/normal/good): ").lower()
        if water in ['bad', 'normal', 'good']:
            env_data['water_quality'] = ENV_MAPPINGS['water_quality'][water]
            break
        print("Please enter bad, normal, or good")

    print("Region Types: urban, rural, coastal, mountain, tropical, desert, forest, river_basin, grassland, dry, cold")
    while True:
        region = input("Region Type: ").lower()
        for key in ENV_MAPPINGS['region_type']:
            if key in region:
                env_data['region_type'] = ENV_MAPPINGS['region_type'][key]
                break
        if 'region_type' in env_data:
            break
        print("Invalid region type - try again")

    print("Weather Types: sunny, rainy, cloudy, snowy, windy, foggy, stormy, sweaty, humid")
    while True:
        weather = input("Current Weather: ").lower()
        for key in ENV_MAPPINGS['weather']:
            if key in weather:
                env_data['weather'] = ENV_MAPPINGS['weather'][key]
                break
        if 'weather' in env_data:
            break
        print("Invalid weather - try again")

    print("\n⏳ When did symptoms first appear?")
    print("1. Recent (<5 days)")
    print("2. Moderate (5-15 days)")
    print("3. Long (>15 days)")
    while True:
        choice = input("Enter choice (1-3): ")
        if choice == '1':
            env_data['time_delay'] = 28
            break
        elif choice == '2':
            env_data['time_delay'] = 29
            break
        elif choice == '3':
            env_data['time_delay'] = 30
            break
        print("Invalid choice. Please enter 1, 2, or 3")
    return env_data

def main():
    try:
        os.makedirs(MODELS_DIR, exist_ok=True)

        model_components = {
            'xgb': ['xgb_model.pkl', 'symptom_features.pkl', 'symptom_data.pkl'],
            'clinical': ['clinical_model.pkl', 'clinical_features.pkl', 'clinical_scaler.pkl'],
            'env': ['env_model.pkl', 'env_features.pkl'],
            'shared': ['disease_encoder.pkl']
        }

        existing_components = {}
        for name, files in model_components.items():
            existing_components[name] = all(os.path.exists(os.path.join(MODELS_DIR, f)) for f in files)

        models = {}
        need_training = not all(existing_components.values())

        if existing_components['shared']:
            models['le'] = joblib.load(os.path.join(MODELS_DIR, 'disease_encoder.pkl'))
        else:
            need_training = True

        if existing_components['xgb']:
            models['xgb'] = joblib.load(os.path.join(MODELS_DIR, 'xgb_model.pkl'))
            models['symptom_cols'] = joblib.load(os.path.join(MODELS_DIR, 'symptom_features.pkl'))
            models['df_symptoms'] = joblib.load(os.path.join(MODELS_DIR, 'symptom_data.pkl'))
        else:
            need_training = True

        if existing_components['clinical']:
            models['lr_clin'] = joblib.load(os.path.join(MODELS_DIR, 'clinical_model.pkl'))
            models['clinical_cols'] = joblib.load(os.path.join(MODELS_DIR, 'clinical_features.pkl'))
            models['clin_scaler'] = joblib.load(os.path.join(MODELS_DIR, 'clinical_scaler.pkl'))
        else:
            need_training = True

        if existing_components['env']:
            models['rf_env'] = joblib.load(os.path.join(MODELS_DIR, 'env_model.pkl'))
            models['env_cols'] = joblib.load(os.path.join(MODELS_DIR, 'env_features.pkl'))
        else:
            need_training = True

        if need_training:
            print("\nSome models are missing - training now...")
            if not train_and_save_models():
                return

            print("\nLoading Models...")
            models = {
                'xgb': joblib.load(os.path.join(MODELS_DIR, 'xgb_model.pkl')),
                'lr_clin': joblib.load(os.path.join(MODELS_DIR, 'clinical_model.pkl')),
                'rf_env': joblib.load(os.path.join(MODELS_DIR, 'env_model.pkl')),
                'le': joblib.load(os.path.join(MODELS_DIR, 'disease_encoder.pkl')),
                'symptom_cols': joblib.load(os.path.join(MODELS_DIR, 'symptom_features.pkl')),
                'clinical_cols': joblib.load(os.path.join(MODELS_DIR, 'clinical_features.pkl')),
                'env_cols': joblib.load(os.path.join(MODELS_DIR, 'env_features.pkl')),
                'clin_scaler': joblib.load(os.path.join(MODELS_DIR, 'clinical_scaler.pkl')),
                'df_symptoms': joblib.load(os.path.join(MODELS_DIR, 'symptom_data.pkl'))
            }

        print("\n" + "="*40)
        print("Disease Prediction System")
        print("="*40)

        symptoms = input("\nDescribe your symptoms (e.g., headache, stomachpain, vomiting, etc...): ").strip()
        if not symptoms:
            raise ValueError("No symptoms provided")

        clinical_data = get_clinical_input()
        env_data = get_environmental_input()

        models_tuple = (
            models['xgb'],
            models['lr_clin'],
            models['rf_env'],
            models['le'],
            models['symptom_cols'],
            models['clinical_cols'],
            models['env_cols'],
            models['clin_scaler'],
            models['df_symptoms']
        )

        predictions, matched_symptoms, unmatched_symptoms = predict_disease(symptoms, clinical_data, env_data, models_tuple)

        print("\n" + "="*40)
        print("Symptom Matching Results:")
        print("="*40)
        print("Matched Symptoms:")
        if matched_symptoms:
            for input_sym, matched_col, score in matched_symptoms:
                print(f"Input: '{input_sym}' -> Matched: '{matched_col}' (Score: {score:.1f})")
        else:
            print("(None)")
        if unmatched_symptoms:
            print("\nUnmatched Symptoms:")
            for sym in unmatched_symptoms:
                print(f"Unmatched symptom to dataset: '{sym}'")
        print("\n" + "="*40)
        print("Top 3 Predicted Diseases with Risk Assessment:")
        print("="*40)
        for pred in predictions:
            print(f"\nDisease: {pred['disease']}")
            print(f"Risk Percentage: {pred['risk_percentage']:.1f}%")
            print(f"Input Symptoms Identified: {', '.join(pred['input_symptoms_identified']) if pred['input_symptoms_identified'] else 'None'}")
            print(f"Symptoms Matched to Disease: {pred['symptoms_matched_to_disease']}")
            print(f"Matched Symptom Names: {', '.join(pred['matched_symptom_names']) if pred['matched_symptom_names'] else 'None'}")
            print(f"Severity Factor: {pred['severity_factor']:.1f}x")
            if pred['warning']:
                print(f"Warning: {pred['warning']}")
        print("="*40)

    except Exception as e:
        print(f"\nError: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Verify CSV files exist in", BASE_DIR)
        print("2. Check file permissions")
        print("3. Delete 'models' folder to force retraining")
        print("4. Ensure input symptoms are valid")
        
if __name__ == "__main__":
    main()