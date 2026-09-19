package com.doezip.user.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import com.doezip.user.service.InvalidProfileException;
import jakarta.validation.constraints.NotBlank;

public record LegalAcceptanceRequest(
    @NotBlank String termsVersion,
    @NotBlank String privacyVersion,
    @NotBlank String aiNoticeVersion
) {
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static LegalAcceptanceRequest from(JsonNode body) {
        if (!body.isObject() || body.size() != 3
                || !body.has("termsVersion") || !body.has("privacyVersion") || !body.has("aiNoticeVersion"))
            throw new InvalidProfileException();
        JsonNode terms = body.get("termsVersion");
        JsonNode privacy = body.get("privacyVersion");
        JsonNode ai = body.get("aiNoticeVersion");
        if (!terms.isTextual() || !privacy.isTextual() || !ai.isTextual()) throw new InvalidProfileException();
        return new LegalAcceptanceRequest(terms.textValue(), privacy.textValue(), ai.textValue());
    }
}
