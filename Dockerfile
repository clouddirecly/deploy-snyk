FROM node:21.7.3-alpine3.20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install semver@7.5.2
RUN npm uninstall semver@5.7.1
WORKDIR /app/dist
CMD ["npm", "run","start"]