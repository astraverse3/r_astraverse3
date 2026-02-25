const fs = require('fs');
const path = require('path');

const dir = 'C:/Users/nbcue/OneDrive/문서/Project/MillingLog/milling-log/app/(dashboard)';

function walk(directory) {
    let results = [];
    const list = fs.readdirSync(directory);
    list.forEach(file => {
        file = path.join(directory, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk(dir);

function mapColor(color, shade, opacity) {
    const isBlue = color === 'blue';
    const baseHex = isBlue ? '#00a2e8' : '#8dc540';
    const darkHex = isBlue ? '#008cc9' : '#7db037';
    const darkerHex = isBlue ? '#007ab3' : '#6ba02c'; // roughly matched 

    let hex = baseHex;
    let baseOpacity = 100;

    const numShade = parseInt(shade, 10);

    if (numShade >= 800) { hex = darkerHex; }
    else if (numShade >= 700) { hex = darkHex; }
    else if (numShade >= 500) { hex = baseHex; }
    else {
        // Light shades get converted to opacity on the base hex
        hex = baseHex;
        if (numShade === 50) baseOpacity = 10;
        else if (numShade === 100) baseOpacity = 20;
        else if (numShade === 200) baseOpacity = 30;
        else if (numShade === 300) baseOpacity = 40;
        else if (numShade === 400) baseOpacity = 50;
    }

    // Combine with explicit opacity if provided
    let finalOpacity = baseOpacity;
    if (opacity) {
        finalOpacity = Math.round(baseOpacity * parseInt(opacity, 10) / 100);
    }

    if (finalOpacity === 100) {
        return `[${hex}]`;
    } else {
        return `[${hex}]/${finalOpacity}`;
    }
}

let totalReplaced = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    const regex = /\b(text|bg|border|decoration|shadow|via|from|to|ring|fill|stroke|divide|outline|caret|accent)-(blue|green)-(\d+)(?:\/(\d+))?\b/g;

    content = content.replace(regex, (match, prefix, color, shade, opacity) => {
        const replacement = `${prefix}-${mapColor(color, shade, opacity)}`;
        return replacement;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        totalReplaced++;
        console.log('Updated', file);
    }
});

console.log(`Replaced colors in ${totalReplaced} files.`);
