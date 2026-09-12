package com.doezip.challenge.dto;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.*;
public final class ChallengeDtos {
    private ChallengeDtos() {}
    public static final String NOTICE_VERSION="challenge-notice-v1";
    public record Notice(String noticeVersion,boolean acknowledged){
        @JsonCreator(mode=JsonCreator.Mode.DELEGATING) public static Notice from(JsonNode node){
            if(node==null||!node.isObject()||node.size()!=2||!node.hasNonNull("noticeVersion")
                ||!node.get("noticeVersion").isTextual()||!NOTICE_VERSION.equals(node.get("noticeVersion").textValue())
                ||!node.hasNonNull("acknowledged")||!node.get("acknowledged").isBoolean()||!node.get("acknowledged").booleanValue())
                throw SessionFailure.invalid();
            return new Notice(NOTICE_VERSION,true);
        }
    }
    public record Statement(UUID id,String statementKey,int order,String text) {}
    public record Run(UUID id,UUID sessionId,String title,String instructionsMarkdown,String noticeVersion,String status,
                      long lockVersion,List<Statement> statements,List<ReviewDtos.Review> reviews,Instant submittedAt) {}
}
