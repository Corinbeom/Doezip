package com.doezip.chat.adapter;
import java.util.function.Consumer;
public interface ChatAdapter {void stream(String context,Consumer<String> delta);}
