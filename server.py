from fastapi import FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
import os
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# الاتصال بقاعدة البيانات
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client.oasis_db
users_collection = db.users

class UserPoints(BaseModel):
    userId: str
    points: int

@app.get("/api/")
async def root():
    return {"message": "Hello World - Oasis Server is Live"}

@app.post("/api/add-points")
async def add_points(user_data: UserPoints):
    user = await users_collection.find_one({"userId": user_data.userId})
    if user:
        new_points = user.get("points", 0) + user_data.points
        await users_collection.update_one(
            {"userId": user_data.userId},
            {"$set": {"points": new_points}}
        )
    else:
        new_points = user_data.points
        await users_collection.insert_one({"userId": user_data.userId, "points": new_points, "minutes": 0})
    
    return {"userId": user_data.userId, "total_points": new_points}

@app.get("/api/convert-to-minutes/{userId}")
async def convert_points(userId: str):
    user = await users_collection.find_one({"userId": userId})
    if not user:
        return {"userId": userId, "minutes": 0, "remaining_points": 0}
    
    total_points = user.get("points", 0)
    # الحسبة: كل 5 نقاط تساوي دقيقة واحدة
    new_minutes = total_points // 5
    remaining_points = total_points % 5
    
    total_minutes = user.get("minutes", 0) + new_minutes
    
    await users_collection.update_one(
        {"userId": userId},
        {"$set": {"points": remaining_points, "minutes": total_minutes}}
    )
    
    return {
        "userId": userId,
        "total_minutes": total_minutes,
        "new_minutes_added": new_minutes,
        "remaining_points": remaining_points
    }
