from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import random
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure_key'

# تفعيل CORS للسماح لتطبيق الموبايل بالاتصال
CORS(app, resources={root: {"origins": "*"}})

# إعداد مجلد تخزين الأصوات
UPLOAD_FOLDER = 'assets/audio_messages'
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# إعداد SocketIO للاتصال اللحظي
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- المسارات (Routes) ---

@app.route('/')
def health_check():
    """التأكد من أن السيرفر يعمل"""
    return {
        "status": "online",
        "system": "Oasis Private Server",
        "version": "2.0.0"
    }

@app.route('/assets/audio_messages/<filename>')
def serve_audio(filename):
    """رابط مباشر لتشغيل ملفات الصوت في التطبيق"""
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/api/upload-audio', methods=['POST'])
def upload_audio():
    """استقبال البصمة الصوتية من الموبايل وحفظها"""
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file"}), 400
        
        file = request.files['audio']
        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # إنشاء اسم ملف فريد وآمن
        timestamp = int(time.time())
        random_suffix = random.randint(1000, 9999)
        filename = secure_filename(f"voice_{timestamp}_{random_suffix}.m4a")
        
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # إرجاع الرابط النسبي ليقوم Firebase بتخزينه
        # سيقوم التطبيق بدمج SERVER_URL مع هذا الرابط للتشغيل
        relative_url = f"assets/audio_messages/{filename}"
        
        return jsonify({
            "status": "success",
            "url": relative_url,
            "full_path": f"{request.host_url}{relative_url}"
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload-status', methods=['POST'])
def upload_status():
    """نظام الحالات (Status)"""
    data = request.json
    if not data:
        return jsonify({"error": "No data"}), 400
        
    new_status = {
        "id": random.randint(1000, 9999),
        "user_email": data.get('email'),
        "content": data.get('content'),
        "timestamp": time.time(),
        "type": data.get('type', 'text')
    }
    return jsonify({"status": "success", "data": new_status})

# --- أحداث Socket.io (للتطوير المستقبلي) ---

@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

@socketio.on('new_message')
def handle_msg(data):
    """إرسال إشعار لحظي (اختياري بجانب Firebase)"""
    emit('receive_message', data, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    print(f"Client disconnected: {request.sid}")

# --- تشغيل السيرفر ---

if __name__ == "__main__":
    # تشغيل متوافق مع بيئة Render و Heroku
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
