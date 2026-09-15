package com.doezip.chat.service;
import java.util.Map;
public class ChatFailure extends RuntimeException {
 public final int status;public final String code;public final Map<String,Object> details;
 public ChatFailure(int status,String code){this(status,code,Map.of());}
 public ChatFailure(int status,String code,Map<String,Object> details){super(code);this.status=status;this.code=code;this.details=details;}
}
