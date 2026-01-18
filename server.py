from flask import Flask
from flask_socketio import SocketIO, emit
import os

app = Flask(__name__)

# إعداد SocketIO للعمل مع السيرفر السحابي
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

@app.route('/')
def index():
    return "Oasis Server is Live & Ready for Calls! 🚀"

# برمجة استقبال وإرسال الرسائل والصوت
@socketio.on('message')
def handle_message(data):
    emit('message', data, broadcast=True)

# برمجة إشارات مكالمات الفيديو
@socketio.on('call')
def handle_call(data):
    emit('call', data, broadcast=True)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, host='0.0.0.0', port=port)
