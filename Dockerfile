FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json /usr/src/app

RUN npm ci --only=production

COPY . /usr/src/app

CMD ["npm","run", "start"]