FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --omit=dev
COPY app.js .
COPY public ./public
RUN mkdir -p /app/data
ENV NODE_OPTIONS=--max-http-header-size=65536
EXPOSE 9006
CMD ["node", "app.js"]