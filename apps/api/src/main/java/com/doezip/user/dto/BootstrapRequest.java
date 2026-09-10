package com.doezip.user.dto;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import com.doezip.user.service.InvalidProfileException;

public record BootstrapRequest(String displayName) {
    // Keep an omitted field distinct from null, and reject Jackson scalar-to-string coercion.
    @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
    public static BootstrapRequest from(JsonNode body) {
        if (!body.isObject() || body.size() > 1 || body.size() == 1 && !body.has("displayName"))
            throw new InvalidProfileException();
        JsonNode name = body.get("displayName");
        if (name != null && !name.isTextual()) throw new InvalidProfileException();
        return new BootstrapRequest(name == null ? null : name.textValue());
    }
}
