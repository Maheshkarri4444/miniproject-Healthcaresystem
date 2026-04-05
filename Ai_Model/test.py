from exp import *
import time
import seaborn as sns
import matplotlib.pyplot as plt
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix
)

def plot_evaluation_metrics(results):
    metrics = {
        'Accuracy': results['accuracy'],
        'Precision': results['precision'],
        'Recall': results['recall'],
        'F1-Weighted': results['f1_score'],
        'F1-Macro': results['f1_macro'],
        'F1-Micro': results['f1_micro']
    }

    plt.figure(figsize=(8, 6))
    sns.barplot(x=list(metrics.keys()), y=list(metrics.values()), palette='viridis')
    plt.title("Evaluation Metrics")
    plt.ylim(0, 1)
    plt.ylabel("Score")
    plt.xticks(rotation=30)
    plt.tight_layout()
    plt.show()

def plot_top_n_accuracy(probs, y_true_encoded, max_n=5):
    top_n_acc = []
    for n in range(1, max_n + 1):
        top_n_pred = np.argsort(probs, axis=1)[:, -n:]
        acc = np.mean([y_true_encoded[i] in top_n_pred[i] for i in range(len(y_true_encoded))])
        top_n_acc.append(acc)
    
    plt.figure(figsize=(10, 6))
    plt.plot(range(1, max_n + 1), top_n_acc, marker='o')
    plt.title(f'Top-N Accuracy (N=1 to {max_n})')
    plt.xlabel('N')
    plt.ylabel('Accuracy')
    plt.xticks(range(1, max_n + 1))
    plt.grid(True)
    plt.show()


def plot_evaluation_time(time_sec, samples_tested):
    plt.figure(figsize=(6, 4))
    plt.bar(["Evaluation"], [time_sec], color='skyblue')
    plt.title(f"Evaluation Time for {samples_tested} Samples")
    plt.ylabel("Time (seconds)")
    plt.tight_layout()
    plt.show()


def plot_correct_incorrect_pie(y_true, y_pred):
    correct = sum(y_true == y_pred)
    incorrect = len(y_true) - correct

    labels = ['Correct Predictions', 'Incorrect Predictions']
    sizes = [correct, incorrect]
    colors = ['limegreen', 'red']

    plt.figure(figsize=(7, 7))
    plt.pie(sizes, labels=labels, autopct='%1.1f%%', startangle=90, colors=colors)
    plt.title("Prediction Accuracy: Correct vs Incorrect")
    plt.axis('equal')
    plt.tight_layout()
    plt.show()


def evaluate_system():
    try:
        print("⚡ Starting memory-safe evaluation...")
        start_time = time.time()

        # Load essential models
        essential_models = {
            'le': joblib.load(os.path.join(MODELS_DIR, 'disease_encoder.pkl')),
            'symptom_cols': joblib.load(os.path.join(MODELS_DIR, 'symptom_features.pkl')),
            'clinical_cols': joblib.load(os.path.join(MODELS_DIR, 'clinical_features.pkl')),
            'env_cols': joblib.load(os.path.join(MODELS_DIR, 'env_features.pkl'))
        }

        # Load and clean datasets
        df_symp = load_data_safely(DATA_PATHS['symptoms'], 'symptoms')
        df_clin = load_data_safely(DATA_PATHS['clinical'], 'clinical')
        df_env = load_data_safely(DATA_PATHS['environmental'], 'environmental')

        # Filter for common diseases
        common_diseases = []
        for disease in essential_models['le'].classes_:
            if min((df_symp['Diseases'] == disease).sum(),
                   (df_clin['Diseases'] == disease).sum(),
                   (df_env['Diseases'] == disease).sum()) >= 5:
                common_diseases.append(disease)

        if not common_diseases:
            raise ValueError("No diseases with sufficient samples across all datasets")

        # Limit test size
        test_samples = min(500, len(common_diseases))
        test_diseases = np.random.choice(common_diseases, test_samples, replace=False)

        # Load all required models
        models = {
            **essential_models,
            'xgb': joblib.load(os.path.join(MODELS_DIR, 'xgb_model.pkl')),
            'lr_clin': joblib.load(os.path.join(MODELS_DIR, 'clinical_model.pkl')),
            'rf_env': joblib.load(os.path.join(MODELS_DIR, 'env_model.pkl')),
            'clin_scaler': joblib.load(os.path.join(MODELS_DIR, 'clinical_scaler.pkl'))
        }

        # Build test records
        test_data = []
        for disease in test_diseases:
            test_data.append({
                'symptoms': df_symp[df_symp['Diseases'] == disease].iloc[0],
                'clinical': df_clin[df_clin['Diseases'] == disease].iloc[0],
                'environmental': df_env[df_env['Diseases'] == disease].iloc[0],
                'disease': disease
            })

        # Process in batches
        batch_size = 50
        all_probs = []
        y_true = []

        def process_batch(batch):
            X_symp = pd.DataFrame([r['symptoms'][models['symptom_cols']] for r in batch])
            X_clin = pd.DataFrame([r['clinical'][models['clinical_cols']] for r in batch]).fillna(0)
            X_env = pd.DataFrame([r['environmental'][models['env_cols']] for r in batch]).ffill()
            X_clin_scaled = models['clin_scaler'].transform(X_clin)

            xgb_probs = models['xgb'].predict_proba(X_symp)
            clin_probs = models['lr_clin'].predict_proba(X_clin_scaled)
            env_probs = models['rf_env'].predict_proba(X_env)

            combined = 0.65 * xgb_probs + 0.18 * clin_probs + 0.17 * env_probs
            return combined

        for i in range(0, len(test_data), batch_size):
            batch = test_data[i:i + batch_size]
            combined_probs = process_batch(batch)
            all_probs.append(combined_probs)
            y_true.extend([r['disease'] for r in batch])

        # Combine predictions and compute metrics
        y_true_encoded = models['le'].transform(y_true)
        y_pred = np.argmax(np.vstack(all_probs), axis=1)

        results = {
            'accuracy': accuracy_score(y_true_encoded, y_pred),
            'precision': precision_score(y_true_encoded, y_pred, average='weighted'),
            'recall': recall_score(y_true_encoded, y_pred, average='weighted'),
            'f1_score': f1_score(y_true_encoded, y_pred, average='weighted'),
            'f1_macro': f1_score(y_true_encoded, y_pred, average='macro'),
            'f1_micro': f1_score(y_true_encoded, y_pred, average='micro'),
            'confusion_matrix': confusion_matrix(y_true_encoded, y_pred),
            'samples_tested': len(y_true),
            'time_sec': time.time() - start_time
        }

        # Print Results
        print(f"\n✅ Evaluation completed in {results['time_sec']:.1f}s")
        print(f"🔹 Accuracy       : {results['accuracy']:.4f}")
        print(f"🔹 Precision      : {results['precision']:.4f}")
        print(f"🔹 Recall         : {results['recall']:.4f}")
        print(f"🔹 F1 Score (Wtd) : {results['f1_score']:.4f}")
        print(f"🔹 F1 Score (Macro): {results['f1_macro']:.4f}")
        print(f"🔹 F1 Score (Micro): {results['f1_micro']:.4f}")
        print(f"🔹 Confusion Matrix:\n{results['confusion_matrix']}")
        print(f"🔹 Samples Tested : {results['samples_tested']}")
        
        plot_top_n_accuracy(np.vstack(all_probs), y_true_encoded)
        plot_correct_incorrect_pie(np.array(y_true_encoded), np.array(y_pred))
        plot_evaluation_metrics(results)
        plot_evaluation_time(results['time_sec'], results['samples_tested']) 

        return results


    except Exception as e:
        print(f"\n❌ Evaluation failed: {str(e)}")
        return None
    

# Run evaluation
evaluate_system()



