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
    @ExceptionHandler({com.doezip.user.service.InvalidProfileException.class, MethodArgumentNotValidException.class, HttpMessageNotReadableException.class, MethodArgumentTypeMismatchException.class, org.springframework.web.bind.MissingRequestHeaderException.class})
    ResponseEntity<ApiError> invalidInput(Exception exception, HttpServletRequest request) {
        return ResponseEntity.badRequest().contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError("INVALID_INPUT", "입력 형식을 확인하세요.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(com.doezip.user.service.UserNotFoundException.class)
    ResponseEntity<ApiError> userNotFound(HttpServletRequest request) {
        return ResponseEntity.status(404).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError("USER_NOT_FOUND", "사용자를 찾을 수 없습니다.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(TaskNotFoundException.class)
    ResponseEntity<ApiError> taskNotFound(HttpServletRequest request) {
        return ResponseEntity.status(404).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError("TASK_NOT_FOUND", "과제를 찾을 수 없습니다.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler({DataAccessException.class, CannotCreateTransactionException.class})
    ResponseEntity<ApiError> databaseUnavailable(HttpServletRequest request) {
        return ResponseEntity.status(503).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError("SERVICE_UNAVAILABLE", "잠시 후 다시 시도하세요.", RequestIdFilter.id(request)));
    }
    @ExceptionHandler(com.doezip.session.service.SessionFailure.class)
    ResponseEntity<ApiError> sessionFailure(com.doezip.session.service.SessionFailure failure, HttpServletRequest request) {
        String message = failure.status == 503 ? "자료를 준비하지 못했습니다. 잠시 후 다시 시도하세요." : failure.status == 404 ? "요청한 자료를 찾을 수 없습니다." : failure.status == 409 ? "저장 상태가 변경되었습니다. 다시 확인하세요." : "입력 형식을 확인하세요.";
        return ResponseEntity.status(failure.status).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError(failure.code, message, RequestIdFilter.id(request)));
    }
    @ExceptionHandler(com.doezip.evaluation.service.EvaluationConflict.class)
    ResponseEntity<java.util.Map<String,Object>> evaluationConflict(com.doezip.evaluation.service.EvaluationConflict failure,HttpServletRequest request){
        return ResponseEntity.status(409).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(java.util.Map.of("code","EVALUATION_IN_PROGRESS","message","이미 처리 중인 평가가 있습니다.","requestId",RequestIdFilter.id(request),"details",java.util.Map.of("evaluationId",failure.evaluationId)));
    }
    @ExceptionHandler(com.doezip.chat.service.ChatFailure.class)
    ResponseEntity<java.util.Map<String,Object>> chatFailure(com.doezip.chat.service.ChatFailure error,HttpServletRequest request){
        String message=error.status==429?"AI 대화 사용 한도에 도달했습니다.":error.code.equals("CHAT_NOT_CONFIGURED")?"AI 대화 연결이 설정되지 않았습니다.":error.status==409?"진행 중인 대화 또는 작성 단계를 확인하세요.":"AI 대화를 처리하지 못했습니다. 잠시 후 다시 시도하세요.";
        return ResponseEntity.status(error.status).cacheControl(org.springframework.http.CacheControl.noStore()).contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(java.util.Map.of("code",error.code,"message",message,"requestId",RequestIdFilter.id(request),"details",error.details));
    }
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception exception, HttpServletRequest request) {
        return ResponseEntity.internalServerError().contentType(org.springframework.http.MediaType.APPLICATION_JSON).body(new ApiError("INTERNAL_ERROR", "요청 처리에 실패했습니다.", RequestIdFilter.id(request)));
    }
}
