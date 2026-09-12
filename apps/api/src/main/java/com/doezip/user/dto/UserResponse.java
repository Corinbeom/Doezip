package com.doezip.user.dto;
import com.doezip.user.entity.UserEntity;
import java.util.UUID;
public record UserResponse(UUID id, String displayName, String email) {
    public static UserResponse from(UserEntity user) { return new UserResponse(user.getId(), user.getDisplayName(), user.getEmail()); }
}
