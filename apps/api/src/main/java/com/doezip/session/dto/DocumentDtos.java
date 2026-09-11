package com.doezip.session.dto;

import com.doezip.session.entity.DocumentVersion;
import com.doezip.session.service.SessionFailure;
import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class DocumentDtos {
    private DocumentDtos() {}
    public record Create(String checkpoint, long expectedDraftLockVersion, String expectedContentHash) {
        @JsonCreator(mode = JsonCreator.Mode.DELEGATING)
        public static Create from(JsonNode node) {
            if (node == null || !node.isObject() || node.size() != 3
                || !node.hasNonNull("checkpoint") || !node.get("checkpoint").isTextual()
                || !List.of("INITIAL", "FINAL").contains(node.get("checkpoint").textValue())
                || !node.hasNonNull("expectedDraftLockVersion") || !node.get("expectedDraftLockVersion").isIntegralNumber()
                || !node.get("expectedDraftLockVersion").canConvertToLong() || node.get("expectedDraftLockVersion").longValue() < 0
                || !node.hasNonNull("expectedContentHash") || !node.get("expectedContentHash").isTextual()
                || !node.get("expectedContentHash").textValue().matches("[0-9a-f]{64}")) throw SessionFailure.invalid();
            return new Create(node.get("checkpoint").textValue(), node.get("expectedDraftLockVersion").longValue(), node.get("expectedContentHash").textValue());
        }
    }
    public record Document(UUID id, UUID sessionId, int versionNo, String checkpoint, String contentMarkdown,
                           String contentHash, long sourceDraftLockVersion, Instant sealedAt, Instant createdAt) {
        public static Document from(DocumentVersion version) {
            return new Document(version.getId(), version.getSessionId(), version.getVersionNo(), version.getCheckpoint(),
                version.getContentMarkdown(), version.getContentHash(), version.getSourceDraftLockVersion(), version.getSealedAt(), version.getCreatedAt());
        }
    }
    public record Documents(List<Document> items) {}
}
