package com.doezip.user.dto;
import com.doezip.user.entity.UserEntity;
import java.util.UUID;
public record UserResponse(UUID id, String displayName, String email, boolean legalAccepted) {
    public static UserResponse from(UserEntity user) {
        boolean accepted = com.doezip.user.service.LegalPolicy.TERMS_VERSION.equals(user.getTermsVersion())
            && com.doezip.user.service.LegalPolicy.PRIVACY_VERSION.equals(user.getPrivacyVersion())
            && com.doezip.user.service.LegalPolicy.AI_NOTICE_VERSION.equals(user.getAiNoticeVersion())
            && user.getLegalAcceptedAt() != null;
        return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail(), accepted);
    }
}
