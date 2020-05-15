FROM node:8.4-alpine
ENV LOG_LEVEL "info"

COPY . /home/nodeapp
RUN chmod +x /home/nodeapp/docker-entrypoint.sh
RUN apk --update add curl ca-certificates &&\
    addgroup -g 1001 nodeapp && \
    adduser -u 1001 -G nodeapp -s /bin/sh -D nodeapp && \
    cd /home/nodeapp && npm install && \
    rm -rf /var/lib/apt/lists/* &&\
    rm -rf /var/cache/apk/*

# Run as the node user ID.
USER nodeapp

WORKDIR /home/nodeapp

EXPOSE 3000

CMD ["npm","start"]