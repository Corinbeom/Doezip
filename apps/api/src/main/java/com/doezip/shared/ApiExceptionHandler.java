package com.doezip.shared;
import org.springframework.dao.DataAccessException;
import org.springframework.transaction.CannotCreateTransactionException;
import com.doezip.task.service.TaskNotFoundException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler({com.doezip.user.service.InvalidProfileException.class, MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ApiError> invalidInput(Exception exception, HttpServletRequest request) {
        return ResponseEntity.badRequest().body(new ApiError("INVALID_INPUT", "입력 형식을 확인하세요.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(com.doezip.user.service.UserNotFoundException.class)
    ResponseEntity<ApiError> userNotFound(HttpServletRequest request) {
        return ResponseEntity.status(404).body(new ApiError("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(TaskNotFoundException.class)
    ResponseEntity<ApiError> taskNotFound(HttpServletRequest request) {
        return ResponseEntity.status(404).body(new ApiError("TASK_NOT_FOUND", "과제를 찾을 수 없습니다.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler({DataAccessException.class, CannotCreateTransactionException.class})
    ResponseEntity<ApiError> databaseUnavailable(HttpServletRequest request) {
        return ResponseEntity.status(503).body(new ApiError("SERVICE_UNAVAILABLE", "잠시 후 다시 시도하세요.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(com.doezip.session.service.SessionFailure.class)
    ResponseEntity<ApiError> sessionFailure(com.doezip.session.service.SessionFailure failure, HttpServletRequest request) {
        String message = failure.status == 404 ? "요청한 자료를 찾을 수 없습니다." : failure.status == 409 ? "저장 상태가 변경되었습니다. 다시 확인하세요." : "입력 형식을 확인하세요.";
        return ResponseEntity.status(failure.status).body(new ApiError(failure.code, message, RequestIdFilter.id(request)));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception exception, HttpServletRequest request) {
        return ResponseEntity.internalServerError().body(new ApiError("INTERNAL_ERROR", "요청 처리에 실패했습니다.", RequestIdFilter.id(request)));
    }
}
