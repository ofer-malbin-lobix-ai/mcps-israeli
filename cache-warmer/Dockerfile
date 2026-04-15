FROM curlimages/curl:8.11.0
USER root
WORKDIR /app
COPY warm.sh ./
RUN chmod +x warm.sh
USER curl_user
CMD ["./warm.sh"]
