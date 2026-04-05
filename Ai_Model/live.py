from exp import *
import streamlit as st
import datetime
from pymongo import MongoClient

# --- MongoDB Connection ---
MONGO_URI = "mongodb://localhost:27017/"
client = MongoClient(MONGO_URI)
db = client["local_db"]
user_collection = db["users"]
prediction_collection = db["predictions"]

# --- Session State ---
if "logged_in" not in st.session_state:
    st.session_state["logged_in"] = False

if "username" not in st.session_state:
    st.session_state["username"] = ""

if "page" not in st.session_state:
    st.session_state["page"] = "login"

# --- Page Switcher ---
def switch_page(page_name):
    st.session_state["page"] = page_name
    st.rerun()

# --- Registration Page ---
def register_page():
    st.title("🆕 Register")
    username = st.text_input("Choose a Username")
    password = st.text_input("Choose a Password", type="password")
    mobile = st.text_input("Enter your mobile number")
    email = st.text_input("Enter your email")
    if st.button("Register"):
        if user_collection.find_one({"username": username}):
            st.error("Username already exists.")
        elif not username or not password:
            st.warning("Fill in all fields.")
        else:
            user_collection.insert_one({"username": username, "password": password, "mobile": mobile, "email": email})
            st.success("Registered successfully! Please login.")
            switch_page("login")
    st.button("Already have an account? Login", on_click=lambda: switch_page("login"))

# --- Login Page ---
def login_page():
    st.title("🔐 Login")
    username = st.text_input("Username")
    password = st.text_input("Password", type="password")
    if st.button("Login"):
        user = user_collection.find_one({"username": username, "password": password})
        if user:
            st.session_state["logged_in"] = True
            st.session_state["username"] = username
            switch_page("main")
        else:
            st.error("Invalid credentials.")
    st.button("New user? Register here", on_click=lambda: switch_page("register"))

# --- Load Models ---
def use_models():
    try:
        with st.spinner("Loading models..."):
            os.makedirs(MODELS_DIR, exist_ok=True)
            model_files = [
                'xgb_model.pkl', 'clinical_model.pkl', 'env_model.pkl',
                'disease_encoder.pkl', 'symptom_features.pkl', 'clinical_features.pkl',
                'env_features.pkl', 'clinical_scaler.pkl', 'symptom_data.pkl'
            ]
            if not all(os.path.exists(os.path.join(MODELS_DIR, f)) for f in model_files):
                if st.button("Train Models Now"):
                    if not train_and_save_models():
                        st.error("Model training failed.")
                        return None
            return tuple(joblib.load(os.path.join(MODELS_DIR, f)) for f in model_files)
    except Exception as e:
        st.error(f"Error loading models: {e}")
        return None

# --- History Page ---
def history_page():
    st.header("📜 Your Prediction History")
    records = prediction_collection.find({"username": st.session_state["username"]}).sort("timestamp", -1)
    records_list = list(records)
    
    if len(records_list) == 0:
        st.write("No prediction history found.")
    else:
        # Prepare data for the table
        history_data = []
        for record in records_list:
            # Convert matched symptoms to a string, in case it's a list
            matched_symptoms = ', '.join([str(symptom) for symptom in record['predictions'].get('matched_symptoms', [])])

            # Extract diseases and risk percentages as strings
            predictions = [f"{pred['disease']} (Risk: {pred['risk_percentage']:.1f}%)" for pred in record['predictions'].get("all_predictions", [])]
            
            history_data.append({
                "Timestamp": record['timestamp'].strftime("%Y-%m-%d %H:%M:%S"),
                "Symptoms": record.get('symptoms', ''),
                "Predictions": ', '.join(predictions),  # Joining predictions into a string
                "Risk (%)": ', '.join([f"{pred['risk_percentage']:.1f}%" for pred in record['predictions'].get("all_predictions", [])]),
                "Matched Symptoms": matched_symptoms
            })
        
        # Convert to DataFrame for easy display in table format
        df = pd.DataFrame(history_data)
        
        # Display the data in a dropdown as a table
        with st.expander("🔍 View History in Table Format"):
            st.dataframe(df)



# --- Main App ---
def live():
    st.set_page_config(page_title="AI Disease Prediction", layout="wide")
    st.title("🧬 Disease Risk Prediction System")
    st.markdown("Combines symptom, clinical, and environmental data for accurate predictions.")

    with st.sidebar:
        app_mode = st.radio("Navigation", ["Prediction", "History"])
        if st.button("Logout"):
            st.session_state.clear()
            switch_page("login")

    models = use_models()
    if not models:
        return

    if app_mode == "Prediction":
        st.header("📋 Enter Your Health Info")
        symptoms = st.text_area("Symptoms (comma-separated):")
        col1, col2 = st.columns(2)
        with col1:
            age = st.slider("Age", 1, 100, 30)
            weight = st.slider("Weight (kg)", 30, 150, 60)
            bp = st.slider("BP", 60, 200, 120)
            sugar = st.slider("Sugar", 50, 300, 100)
        with col2:
            cholesterol = st.slider("Cholesterol", 10, 300, 180)
            wbc = st.slider("WBC", 2, 20, 6)
            bmi = st.slider("BMI", 5.0, 40.0, 22.0)
            sleep = st.slider("Sleep (hrs)", 0, 12, 7)

        st.subheader("🌍 Environmental Factors")
        col1, col2 = st.columns(2)
        with col1:
            temp = st.selectbox("Temperature", ['low', 'medium', 'high'])
            humidity = st.selectbox("Humidity", ['low', 'medium', 'high'])
            air = st.selectbox("Air Quality", ['bad', 'normal', 'good'])
            water = st.selectbox("Water Quality", ['bad', 'normal', 'good'])
        with col2:
            region = st.selectbox("Region Type", list(ENV_MAPPINGS['region_type'].keys()))
            weather = st.selectbox("Weather", list(ENV_MAPPINGS['weather'].keys()))
            delay = st.selectbox("Symptom Duration", ['recent', 'moderate', 'long'])

        if st.button("Predict"):
            clinical = {'Age': age, 'Weight': weight, 'BP': bp, 'Sugar': sugar,
                        'Cholesterol': cholesterol, 'WBC': wbc, 'BMI': bmi, 'Sleep': sleep}
            environmental = {
                'temperature': ENV_MAPPINGS['temperature'][temp],
                'humidity': ENV_MAPPINGS['humidity'][humidity],
                'air_quality': ENV_MAPPINGS['air_quality'][air],
                'water_quality': ENV_MAPPINGS['water_quality'][water],
                'region_type': ENV_MAPPINGS['region_type'][region],
                'weather': ENV_MAPPINGS['weather'][weather],
                'time_delay': ENV_MAPPINGS['time_delay'][delay][0]
            }
            with st.spinner("Analyzing..."):
                try:
                    predictions, matched, unmatched = predict_disease(symptoms, clinical, environmental, models)
                    st.header("🩺 Prediction Results")
                    for pred in predictions:
                        st.subheader(f"{pred['disease']}")
                        st.write(f"Risk: {pred['risk_percentage']:.1f}%")
                        st.write(f"Matched Symptoms: {', '.join(pred['matched_symptom_names'])}")
                        st.write(f"Severity Factor: {pred['severity_factor']:.2f}")
                        if pred['warning']:
                            st.warning(pred['warning'])

                    if matched:
                        with st.expander("🔍 Matched Symptoms"):
                            for sym in matched:
                                st.write(f"Input: {sym[0]} → Matched: {sym[1]} (Score: {sym[2]:.1f})")
                    if unmatched:
                        with st.expander("❌ Unmatched Symptoms"):
                            st.write(", ".join(unmatched))

                    # Save prediction data to MongoDB
                    prediction_collection.insert_one({
                        "username": st.session_state["username"],
                        "timestamp": datetime.datetime.utcnow(),
                        "symptoms": symptoms,
                        "clinical_data": clinical,
                        "environmental_data": environmental,
                        "predictions": {
                            "all_predictions": predictions,
                            "matched_symptoms": matched,
                            "unmatched_symptoms": unmatched
                        }
                    })
                    st.success("✅ Prediction result saved successfully.")
                except Exception as e:
                    st.error(f"Prediction error: {e}")

    elif app_mode == "History":
        history_page()

# --- App Entry ---
if st.session_state["logged_in"]:
    live()
elif st.session_state["page"] == "login":
    login_page()
elif st.session_state["page"] == "register":
    register_page()
