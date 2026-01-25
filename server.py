from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import time

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure_key'

# تفعيل CORS
CORS(app, resources={r"/*": {"origins": "*"}})

# إعداد المجلدات الأساسية للوسائط
UPLOAD_ROOT = 'assets'
folders = {
    'audio': os.path.join(UPLOAD_ROOT, 'audio_messages'),
    'image': os.path.join(UPLOAD_ROOT, 'images'),
    'video': os.path.join(UPLOAD_ROOT, 'videos')
}

# إنشاء المجلدات إذا لم تكن موجودة
for folder_path in folders.values():
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)

# إعداد SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- المسارات (Routes) ---

@app.route('/')
def health_check():
    return {"status": "online", "system": "Oasis Media Server", "version": "3.0.0"}

# مسار لجلب الملفات (يخدم الصور والفيديو والصوت)
@app.route('/assets/<path:subpath>')
def serve_media(subpath):
    return send_from_directory(UPLOAD_ROOT, subpath)

# المسار الموحد لرفع الوسائط (صوت، صورة، فيديو)
@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file part"}), 400
        
        file = request.files['file']
        media_type = request.form.get('type') # 'audio', 'image', or 'video'
        
        if not media_type or media_type not in folders:
            return jsonify({"error": "Invalid media type"}), 400

        if file.filename == '':
            return jsonify({"error": "No selected file"}), 400

        # إنشاء اسم ملف فريد وآمن
        ext = file.filename.split('.')[-1]
        filename = secure_filename(f"{media_type}_{int(time.time())}.{ext}")
        
        # تحديد المسار الفعلي للحفظ
        target_folder = folders[media_type]
        filepath = os.path.join(target_folder, filename)
        file.save(filepath)

        # الرابط الذي سيخزن في Firebase
        relative_url = f"assets/{media_type if media_type != 'audio' else 'audio_messages'}/{filename}"
        
        return jsonify({
            "status": "success",
            "url": relative_url,
            "full_path": f"{request.host_url}{relative_url}"
        }), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- Socket.io (للاتصال اللحظي) ---
@socketio.on('connect')
def handle_connect():
    print(f"Client connected: {request.sid}")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
