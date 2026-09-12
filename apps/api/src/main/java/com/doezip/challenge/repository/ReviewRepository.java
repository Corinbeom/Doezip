package com.doezip.challenge.repository;
import com.doezip.challenge.dto.ReviewDtos.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
@Repository
public class ReviewRepository {
 private final JdbcTemplate db;
 public ReviewRepository(JdbcTemplate db){this.db=db;}
 public List<Review> find(UUID run){
  return db.query("SELECT * FROM fault_attempts WHERE challenge_run_id=? ORDER BY statement_id",(r,i)->{
   UUID id=r.getObject("id",UUID.class);
   var evidence=db.query("SELECT * FROM evidence_links WHERE fault_attempt_id=? ORDER BY material_id,line_start,line_end",(e,j)->new Evidence(e.getObject("id",UUID.class),e.getObject("material_id",UUID.class),e.getInt("line_start"),e.getInt("line_end"),e.getString("quoted_text"),e.getString("relation"),e.getString("origin"),e.getString("review_status"),e.getString("user_note")),id);
   return new Review(id,r.getObject("statement_id",UUID.class),r.getString("decision"),r.getString("reason_text"),r.getString("replacement_text"),evidence);
  },run);
 }
 public void replace(UUID run,UUID template,List<Review> reviews){
  Set<UUID> keep=new HashSet<>();reviews.forEach(r->keep.add(r.id()));
  for(var old:find(run))if(!keep.contains(old.id())){db.update("DELETE FROM evidence_links WHERE fault_attempt_id=?",old.id());db.update("DELETE FROM fault_attempts WHERE id=?",old.id());}
  for(var r:reviews){
   db.update("INSERT INTO fault_attempts(id,challenge_run_id,challenge_template_id,statement_id,decision,reason_text,replacement_text) VALUES (?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET decision=excluded.decision,reason_text=excluded.reason_text,replacement_text=excluded.replacement_text,updated_at=now()",r.id(),run,template,r.statementId(),r.decision(),r.reasonText(),r.replacementText());
   db.update("DELETE FROM evidence_links WHERE fault_attempt_id=?",r.id());
   for(var e:r.evidence())db.update("INSERT INTO evidence_links(id,fault_attempt_id,material_id,line_start,line_end,quoted_text,relation,origin,review_status,user_note) VALUES (?,?,?,?,?,?,?,'USER','ACCEPTED',?)",e.id(),r.id(),e.materialId(),e.lineStart(),e.lineEnd(),e.quotedText(),e.relation(),e.userNote());
  }
 }
}
