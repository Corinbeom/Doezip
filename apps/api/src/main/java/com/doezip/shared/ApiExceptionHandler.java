package com.doezip.shared;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ApiError> invalidInput(Exception exception, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", "입력 형식을 확인하세요.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception exception, HttpServletRequest request) {
        return ResponseEntity.internalServerError().body(new ApiError("INTERNAL_ERROR", "요청 처리에 실패했습니다.", RequestIdFilter.id(request)));
    }
}
