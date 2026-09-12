package com.doezip.challenge.dto;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;
public final class ReviewDtos {
 private ReviewDtos() {}
 public record EvidenceInput(UUID materialId,int lineStart,int lineEnd,String relation,String userNote) {}
 public record Input(UUID statementId,String decision,String reasonText,String replacementText,List<EvidenceInput> evidence) {}
 public record Evidence(UUID id,UUID materialId,int lineStart,int lineEnd,String quotedText,String relation,String origin,String reviewStatus,String userNote) {}
 public record Review(UUID id,UUID statementId,String decision,String reasonText,String replacementText,List<Evidence> evidence) {}
 public record Save(long expectedLockVersion,List<Input> reviews) {
  @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Save from(JsonNode n){
   fields(n,Set.of("expectedLockVersion","reviews"),Set.of());long version=version(n);
   if(!n.get("reviews").isArray()||n.get("reviews").size()>20)throw SessionFailure.invalid();
   List<Input> reviews=new ArrayList<>();
   for(var r:n.get("reviews")){
    fields(r,Set.of("statementId","decision","reasonText","replacementText","evidence"),Set.of());
    String decision=text(r.get("decision"),40,false);if(!Set.of("KEEP","CORRECT","INSUFFICIENT_EVIDENCE").contains(decision))throw SessionFailure.invalid();
    String reason=text(r.get("reasonText"),2000,false),replacement=text(r.get("replacementText"),4000,true);
    if(!r.get("evidence").isArray()||r.get("evidence").size()>6)throw SessionFailure.invalid();
    List<EvidenceInput> evidence=new ArrayList<>();
    for(var e:r.get("evidence")){
     fields(e,Set.of("materialId","lineStart","lineEnd","relation"),Set.of("userNote"));
     String relation=text(e.get("relation"),20,false);if(!Set.of("SUPPORTS","CONTRADICTS","CONTEXT").contains(relation))throw SessionFailure.invalid();
     evidence.add(new EvidenceInput(uuid(e.get("materialId")),positive(e.get("lineStart")),positive(e.get("lineEnd")),relation,e.has("userNote")?(e.get("userNote").isTextual()&&e.get("userNote").textValue().isEmpty()?"":text(e.get("userNote"),2000,false)):null));
    }
    reviews.add(new Input(uuid(r.get("statementId")),decision,reason,replacement,evidence));
   }
   return new Save(version,reviews);
  }
 }
 public record Submit(long expectedLockVersion){
  @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Submit from(JsonNode n){fields(n,Set.of("expectedLockVersion"),Set.of());return new Submit(version(n));}
 }
 static void fields(JsonNode n,Set<String> required,Set<String> optional){
  if(n==null||!n.isObject())throw SessionFailure.invalid();
  for(String k:required)if(!n.has(k))throw SessionFailure.invalid();
  n.fieldNames().forEachRemaining(k->{if(!required.contains(k)&&!optional.contains(k))throw SessionFailure.invalid();});
 }
 static long version(JsonNode n){var v=n.get("expectedLockVersion");if(!v.isIntegralNumber()||!v.canConvertToLong()||v.longValue()<0)throw SessionFailure.invalid();return v.longValue();}
 static int positive(JsonNode n){if(!n.isIntegralNumber()||!n.canConvertToInt()||n.intValue()<1)throw SessionFailure.invalid();return n.intValue();}
 static UUID uuid(JsonNode n){try{String s=n.textValue();UUID id=UUID.fromString(s);if(!id.toString().equalsIgnoreCase(s))throw SessionFailure.invalid();return id;}catch(Exception e){throw SessionFailure.invalid();}}
 static String text(JsonNode n,int max,boolean nullable){
  if(nullable&&n.isNull())return null;if(!n.isTextual())throw SessionFailure.invalid();
  String s=n.textValue().replace("\r\n","\n").replace('\r','\n');
  if(s.codePointCount(0,s.length())>max||s.codePoints().anyMatch(c->c==0||c>=0xD800&&c<=0xDFFF))throw SessionFailure.invalid();
  return s;
 }
}
