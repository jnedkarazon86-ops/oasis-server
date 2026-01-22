from flask import Flask, request, jsonify
from flask_socketio import SocketIO, emit
from flask_mail import Mail, Message
import os
import random
import time # للإضافة الجديدة: توقيت الحالات

app = Flask(__name__)
app.config['SECRET_KEY'] = 'oasis_2026_secure'

# --- 1. إعدادات الإيميل (كما هي في ملفك الأصلي) ---
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'
mail = Mail(app)
otp_storage = {}

# --- 2. رابط إعلاناتك الخاص (الذي وضعته عند البرمجة) ---
ADSTERRA_DIRECT_LINK = "https://www.effectivegatecpm.com/pv5wwvpt?key=d089e046a8ec90d9b2b95e7b32944807"

# --- 3. نظام الحالات الجديد (Status System) ---
# تخزين الحالات في الذاكرة (يمكن تطويره لقاعدة بيانات لاحقاً)
statuses = [] 

# --- 4. إعدادات الاتصال الحي ---
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def index():
    return "Oasis Server: All Systems (Email, Video, Audio, Ads, Status) are Online! 🚀"

# مسار جلب الإعلانات (مخفي ونشط كل 15 ثانية)
@app.route('/api/ads-config')
def get_ads():
    return jsonify({
        "ad_url": ADSTERRA_DIRECT_LINK,
        "interval": 15000
    })

# --- إضافة مسارات الحالات الجديدة ---

@app.route('/api/upload-status', methods=['POST'])
def upload_status():
    data = request.json
    new_status = {
        "id": random.randint(1000, 9999),
        "user_email": data.get('email'),
        "content": data.get('content'), # رابط الصورة أو النص
        "timestamp": time.time(),
        "type": data.get('type', 'image') # image or text
    }
    statuses.append(new_status)
    return jsonify({"status": "success", "message": "تم نشر الحالة بنجاح"})

@app.route('/api/get-statuses', methods=['GET'])
def get_statuses():
    # تنظيف الحالات التي مضى عليها أكثر من 24 ساعة
    current_time = time.time()
    global statuses
    statuses = [s for s in statuses if current_time - s['timestamp'] < 86400]
    return jsonify(statuses)

# --- نظام التحقق والمكالمات (الموجود مسبقاً في ملفاتك) ---
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

@socketio.on('call_signal')
def handle_call(data):
    emit('on_call_received', data, broadcast=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
