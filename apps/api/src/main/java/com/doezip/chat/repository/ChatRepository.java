package com.doezip.chat.repository;
import com.doezip.chat.dto.ChatDtos.*;
import java.util.*;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class ChatRepository {
 private final JdbcTemplate db;public ChatRepository(JdbcTemplate db){this.db=db;}
 private Message row(ResultSet r,int index)throws SQLException{return new Message(r.getObject("id",UUID.class),r.getLong("seq_no"),r.getString("role"),r.getString("content_text"),r.getString("status"),r.getObject("reply_to_message_id",UUID.class),r.getTimestamp("created_at").toInstant(),r.getTimestamp("completed_at")==null?null:r.getTimestamp("completed_at").toInstant());}
 public List<Message> list(UUID session,long after,int limit){return db.query("SELECT * FROM chat_messages WHERE session_id=? AND seq_no>? ORDER BY seq_no LIMIT ?",this::row,session,after,limit);}
 public Optional<Message> byKey(UUID session,UUID key){return db.query("SELECT * FROM chat_messages WHERE session_id=? AND client_message_key=? AND role='USER'",this::row,session,key).stream().findFirst();}
 public Message reply(UUID user){return db.query("SELECT * FROM chat_messages WHERE reply_to_message_id=?",this::row,user).getFirst();}
 public Message get(UUID id){return db.query("SELECT * FROM chat_messages WHERE id=?",this::row,id).getFirst();}
 public boolean includesDraft(UUID id){return Boolean.TRUE.equals(db.queryForObject("SELECT include_current_draft FROM chat_messages WHERE id=?",Boolean.class,id));}
 public Optional<Message> active(UUID session){return db.query("SELECT * FROM chat_messages WHERE session_id=? AND status='STREAMING'",this::row,session).stream().findFirst();}
 public void expire(UUID session){db.update("UPDATE chat_messages SET status='FAILED',completed_at=now() WHERE session_id=? AND status='STREAMING' AND created_at < now()-interval '90 seconds'",session);}
 public void reserve(UUID user,int daily,int global){
  db.execute("SELECT pg_advisory_xact_lock(1460314)");
  Long all=db.queryForObject("SELECT count(*) FROM chat_messages WHERE role='USER' AND created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",Long.class);
  Long own=db.queryForObject("SELECT count(*) FROM chat_messages m JOIN learning_sessions s ON s.id=m.session_id WHERE m.role='USER' AND s.user_id=? AND m.created_at >= date_trunc('day',now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'",Long.class,user);
  if(all>=global||own>=daily)throw new com.doezip.chat.service.ChatFailure(429,"CHAT_LIMIT_REACHED");
 }
 public void insert(UUID session,UUID id,long seq,String role,String text,String status,UUID reply,UUID key,boolean draft,String model){db.update("INSERT INTO chat_messages(id,session_id,seq_no,role,content_text,status,reply_to_message_id,client_message_key,include_current_draft,provider,model,completed_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,CASE WHEN ?='COMPLETED' THEN now() ELSE NULL END)",id,session,seq,role,text,status,reply,key,draft,role.equals("ASSISTANT")?"gemini":null,model,status);}
 public boolean progress(UUID id,String text){return db.update("UPDATE chat_messages SET content_text=? WHERE id=? AND status='STREAMING' AND created_at>=now()-interval '90 seconds'",text,id)==1;}
 public Message finish(UUID id,String status){db.update("UPDATE chat_messages SET status=?,completed_at=now() WHERE id=? AND status='STREAMING'",status,id);return get(id);}
}
