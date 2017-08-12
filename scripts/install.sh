#!/bin/bash

gulp build
gulp copy
cd ./build/src/controlPannel/public
bower install
