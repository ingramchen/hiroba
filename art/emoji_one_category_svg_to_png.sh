# install imagemagic with svg
#   brew install imagemagick --with-librsvg
#
out="`pwd`/out_category_png"
input="emoji_one_category_icons"

rm -rf $out
mkdir -p $out 

cd $input

for f in `ls -1 *.svg`
do
   name=${f%'.svg'}
   convert -density 480 -background none -resize 16 -unsharp 2x0.5+1.5+0 -quality 100 $f $out/${name}.png
   convert -density 480 -background none -resize 32 -unsharp 2x0.5+1.5+0 -quality 100 $f $out/${name}_2x.png
done

echo
echo "done, check $out folder."
echo
echo "1) you should optimize png with software like ImageOptim."
