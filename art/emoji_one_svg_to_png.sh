# install imagemagic with svg
#   brew install imagemagick --with-librsvg
#
out="`pwd`/one_png"
input="emoji_one_2016_01_29_svg"

rm -rf $out
mkdir -p $out 

cd $input

for f in `ls -1 *.svg`
do
   name=${f%'.svg'}
   convert -density 480 -background none -resize 24x24 -unsharp 2x0.5+1.5+0 -quality 100 $f $out/${name}.png
   convert -density 480 -background none -resize 48x48 -unsharp 2x0.5+1.5+0 -quality 100 $f $out/${name}_2x.png
done

echo
echo "done, check $out folder."
echo
echo "1) you should optimize png with software like ImageOptim."
echo "2) mv one_png/* ../hiroba-server/src/main/webapp/com.liquable.hiroba/emoji/emoji_one"

