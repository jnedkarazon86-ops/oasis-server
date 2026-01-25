from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import random
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure'
CORS(app) # السماح للموبايل بالاتصال بالسيرفر

# إعداد مجلد لرفع الأصوات
UPLOAD_FOLDER = 'assets/audio_messages'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# --- 1. إعدادات الإيميل ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com' # بريدك هنا
app.config['MAIL_PASSWORD'] = 'your-app-password' # كلمة سر التطبيقات من جوجل
mail = Mail(app)
otp_storage = {}

# --- 2. إعدادات الاتصال الحي ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# السماح للتطبيق بتحميل ملفات الصوت من السيرفر
@app.route('/assets/audio_messages/<filename>')
def serve_audio(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/')
def index():
    return {"status": "online", "message": "Oasis Server is running"}

# --- 3. ميزة رفع الصوت (تم تصحيح الرابط ليعمل على الموبايل) ---
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
    
    # تحويل المسار المحلي لرابط URL كامل يمكن للموبايل تشغيله
    full_url = f"{request.host_url}{filepath}"
    
    socketio.emit('new_voice_message', {"url": full_url, "sender": request.form.get('user')})
    
    return jsonify({"status": "success", "url": full_url})

# --- 4. نظام الحالات والتحقق ---
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
    return jsonify({"status": "success", "data": new_status})

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
