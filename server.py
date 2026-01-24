from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
from werkzeug.utils import secure_filename
import os
import random
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure'

# إعداد مجلد لرفع الأصوات
UPLOAD_FOLDER = 'assets/audio_messages'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- 1. إعدادات الإيميل ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
# ملاحظة: ضع إيميلك وكلمة سر التطبيقات هنا
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'
mail = Mail(app)
otp_storage = {}

# --- 2. الإعلانات والحالات ---
ADSTERRA_DIRECT_LINK = "https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807"
statuses = [] 

# --- 3. إعدادات الاتصال الحي ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def index():
    return {"status": "online", "message": "Oasis Backend v2.0 is running"}

# --- 4. ميزة إرسال الصوت الجديدة ---
@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file"}), 400
    
    file = request.files['audio']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400
    
    filename = secure_filename(f"voice_{int(time.time())}_{random.randint(100,999)}.m4a")
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)
    
    # هنا نرسل إشارة عبر Socket لجميع المستخدمين بوجود رسالة صوتية جديدة
    socketio.emit('new_voice_message', {"url": filepath, "sender": request.form.get('user')})
    
    return jsonify({"status": "success", "url": filepath})

# --- 5. نظام الحالات ---
@app.route('/api/upload-status', methods=['POST'])
def upload_status():
    data = request.json
    new_status = {
        "id": random.randint(1000, 9999),
        "user_email": data.get('email'),
        "content": data.get('content'),
        "timestamp": time.time(),
        "type": data.get('type', 'text')
    }
    statuses.append(new_status)
    return jsonify({"status": "success"})

@app.route('/api/get-statuses', methods=['GET'])
def get_statuses():
    current_time = time.time()
    global statuses
    # حذف الحالات القديمة (أكبر من 24 ساعة)
    statuses = [s for s in statuses if current_time - s['timestamp'] < 86400]
    return jsonify(statuses)

# --- 6. نظام التحقق والمكالمات ---
@app.route('/api/verify-email', methods=['POST'])
def send_verification():
    email = request.json.get('email')
    code = str(random.randint(100000, 999999))
    otp_storage[email] = code
    try:
        msg = Message('كود التحقق من واحة (Oasis)', sender=app.config['MAIL_USERNAME'], recipients=[email])
        msg.body = f'كود التحقق الخاص بك هو: {code}'
        mail.send(msg)
        return jsonify({"status": "sent"})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@socketio.on('new_message')
def handle_msg(data):
    emit('receive_message', data, broadcast=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
