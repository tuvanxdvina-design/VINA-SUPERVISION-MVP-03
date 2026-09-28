import os, json
from uuid import UUID
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg

DATABASE_URL=os.getenv('DATABASE_URL','postgresql://vina_admin:change_this_password@localhost:5432/vina_supervision')
app=FastAPI(title='VINA-SUPERVISION API',version='0.2.0')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:8080','http://127.0.0.1:8080'],allow_methods=['*'],allow_headers=['*'])
class Record(BaseModel):
    entity_type:str
    entity_id:UUID
    payload:dict[str,Any]
class Batch(BaseModel):
    records:list[Record]=[]
def conn(): return psycopg.connect(DATABASE_URL)
@app.get('/health')
def health():
    try:
        with conn() as c:
            c.execute('select 1')
        return {'status':'ok','service':'vina-supervision-api','database':'ok'}
    except Exception as e: raise HTTPException(503,detail=str(e))
@app.get('/api/v1')
def root(): return {'service':'VINA-SUPERVISION','version':'0.2.0','status':'connected'}
@app.post('/api/v1/sync')
def sync(batch:Batch):
    with conn() as c:
        for r in batch.records:
            c.execute('''INSERT INTO mvp_records(entity_type,entity_id,payload,updated_at) VALUES(%s,%s,%s::jsonb,now()) ON CONFLICT(entity_type,entity_id) DO UPDATE SET payload=EXCLUDED.payload,updated_at=now()''',(r.entity_type,str(r.entity_id),json.dumps(r.payload)))
    return {'status':'ok','count':len(batch.records)}
@app.get('/api/v1/records')
def records(entity_type:str|None=None):
    with conn() as c:
        if entity_type: rows=c.execute('select entity_type,entity_id,payload,updated_at from mvp_records where entity_type=%s order by updated_at desc',(entity_type,)).fetchall()
        else: rows=c.execute('select entity_type,entity_id,payload,updated_at from mvp_records order by updated_at desc').fetchall()
    return [{'entity_type':a,'entity_id':str(b),'payload':d,'updated_at':e.isoformat()} for a,b,d,e in rows]
