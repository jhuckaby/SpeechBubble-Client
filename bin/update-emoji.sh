#!/bin/bash

# Update Emoji Regex:
# cd ~/node_modules/gen-emoji-regex
# npm install emoji-datasource
# node gen-emoji-regex.js 
# node gen-skin-tones.js 

# home directory
SCRIPT=`perl -MCwd -le 'print Cwd::abs_path(shift)' "$0"`
DIR=`dirname $SCRIPT`
HOMEDIR=`dirname $DIR`
cd $HOMEDIR

# emoji-datasource update
npm install emoji-datasource
rm -rf node_modules/emoji-datasource/img
rm node_modules/emoji-datasource/emoji_pretty.json

mkdir -p htdocs/images/emoji
curl -L -o htdocs/images/emoji/sheet_apple_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_apple_64.png
# curl -L -o htdocs/images/emoji/sheet_emojione_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_emojione_64.png
curl -L -o htdocs/images/emoji/sheet_facebook_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_facebook_64.png
curl -L -o htdocs/images/emoji/sheet_google_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_google_64.png
# curl -L -o htdocs/images/emoji/sheet_messenger_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_messenger_64.png
curl -L -o htdocs/images/emoji/sheet_twitter_64.png https://github.com/iamcal/emoji-data/raw/master/sheet_twitter_64.png
