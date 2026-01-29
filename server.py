import os
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO
from flask_cors import CORS
from werkzeug.utils import secure_filename
from dotenv import load_dotenv

# تحميل متغيرات البيئة
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'oasis_2026_default_key')

# تفعيل CORS لدعم تطبيقات الأندرويد والآيفون بشكل كامل
CORS(app, resources={r"/*": {"origins": "*"}})

# إعدادات المجلدات وتلقائياً إنشاءها
UPLOAD_ROOT = 'assets'
SUB_FOLDERS = {
    'image': 'images',
    'video': 'videos',
    'audio': 'audio_messages'
}

for folder in SUB_FOLDERS.values():
    os.makedirs(os.path.join(UPLOAD_ROOT, folder), exist_ok=True)

# إعداد SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def index():
    return jsonify({
        "status": "active",
        "platform": "Oasis Media Server",
        "time": int(time.time())
    })

# تحسين خدمة الملفات لضمان ظهور الصور فور تحديثها
@app.route('/assets/<path:folder>/<path:filename>')
def serve_media(folder, filename):
    response = send_from_directory(os.path.join(UPLOAD_ROOT, folder), filename)
    # إضافة هيدر لمنع الكاش لضمان تحديث صورة البروفايل فوراً
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    return response

@app.route('/api/upload-media', methods=['POST'])
def upload_media():
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file shared"}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({"error": "No filename"}), 400

        # استخراج امتداد الملف بدقة
        ext = file.filename.rsplit('.', 1)[-1].lower() if '.' in file.filename else 'jpg'
        
        # التحديد الذكي لنوع الميديا
        if ext in ['m4a', 'mp3', 'wav', 'ogg', 'aac']:
            media_type = 'audio'
        elif ext in ['mp4', 'mov', 'avi', 'mkv']:
            media_type = 'video'
        else:
            media_type = 'image'

        # توليد اسم فريد باستخدام الوقت لمنع تداخل الصور
        filename = secure_filename(f"oasis_{int(time.time() * 1000)}_{file.filename}")
        if not filename.endswith(f".{ext}"):
            filename = f"{filename}.{ext}"
            
        target_path = os.path.join(UPLOAD_ROOT, SUB_FOLDERS[media_type], filename)
        file.save(target_path)

        # بناء الرابط الكامل
        server_base_url = request.host_url.rstrip('/')
        final_url = f"{server_base_url}/assets/{SUB_FOLDERS[media_type]}/{filename}"

        return jsonify({
            "status": "success",
            "url": final_url,
            "media_type": media_type,
            "filename": filename
        }), 201

    except Exception as e:
        print(f"Server Error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    socketio.run(app, host='0.0.0.0', port=port)
