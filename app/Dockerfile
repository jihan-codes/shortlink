FROM node:22-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY server.js .
EXPOSE 3000
HEALTHCHECK --interval=5s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
