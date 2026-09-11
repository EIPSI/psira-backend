#!/bin/bash

#run migrations when database is online
./wait-for-it.sh postgres:5432 && node dist/migrate.js

#start node
node dist/main.js
