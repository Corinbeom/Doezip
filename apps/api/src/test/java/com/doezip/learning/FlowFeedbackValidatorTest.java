package com.doezip.learning;
import com.doezip.learning.adapter.FlowFeedbackValidator;
import com.fasterxml.jackson.databind.*;
import com.fasterxml.jackson.databind.node.*;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;
class FlowFeedbackValidatorTest {
 final ObjectMapper json=new ObjectMapper();
 ObjectNode input(){var input=json.createObjectNode();input.putArray("records").addObject().put("id","artifact").put("label","제출물").put("text","first line\nsecond line");return input;}
 ObjectNode candidate(){var out=json.createObjectNode().put("practiceArea","VERIFY");var items=out.putArray("items");for(String area:new String[]{"REQUEST","VERIFY","IMPROVE","EXPLAIN"})items.addObject().put("area",area).put("observation","기록에서 확인한 범위만 설명합니다.").put("nextAction","다음 확인을 해보세요.").putArray("recordIds").add("artifact");return out;}
 @Test void exactMultilineEvidenceIsResolvedFromSnapshot(){var result=new FlowFeedbackValidator().validate(candidate(),input());assertThat(result.path("items").get(0).path("sources").get(0).path("text").asText()).isEqualTo("first line\nsecond line");}
 @Test void forgedSourceAndUnsupportedCommentCannotPublish(){var c=candidate();((ArrayNode)c.path("items").get(0).path("recordIds")).removeAll().add("another-user-record");assertThatThrownBy(()->new FlowFeedbackValidator().validate(c,input())).isInstanceOf(IllegalArgumentException.class);var noEvidence=candidate();((ArrayNode)noEvidence.path("items").get(0).path("recordIds")).removeAll();assertThatThrownBy(()->new FlowFeedbackValidator().validate(noEvidence,input())).isInstanceOf(IllegalArgumentException.class);}
 @Test void generatedQuoteOrScoreAndDuplicateAreasAreRejected(){var c=candidate();((ObjectNode)c.path("items").get(0)).put("quote","invented quote");assertThatThrownBy(()->new FlowFeedbackValidator().validate(c,input())).isInstanceOf(IllegalArgumentException.class);var d=candidate();((ObjectNode)d.path("items").get(1)).put("area","REQUEST");assertThatThrownBy(()->new FlowFeedbackValidator().validate(d,input())).isInstanceOf(IllegalArgumentException.class);}
}
