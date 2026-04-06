FROM rabbitmq:3.13-management-alpine

# Enable STOMP plugin for WebSocket message broker
RUN rabbitmq-plugins enable --offline rabbitmq_stomp

EXPOSE 5672 15672 61613
