# install imagemagic with svg
#   brew install imagemagick --with-librsvg
#
out="`pwd`/hdpi_png"
input="pidgin-2.10.12-pixmaps/emotes/default/24/scalable"

rm -rf $out
mkdir -p $out 

cd $input

for f in `ls -1 *.svg`
do
   name=${f%'.svg'}
   name=`echo $name | tr '[a-z\-]' '[A-Z_]'`
   convert -density 480 -background none -resize 48x48 $f $out/$name.png
done

echo
echo "done, check $out folder."
echo
echo "you should optimize png with software like ImageOptim."

