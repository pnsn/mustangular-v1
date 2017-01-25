mustangular
===========
An Angular.js application that displays station metrics from the IRIS MUSTANG service on a leaflet map. 


General Information:
-------------------
###Form:
The form capitalizes input to the text entry boxes. The metric select is populated from the IRIS MUSTANG metric service. The form cannot be submitted until a date range and a metric is selected.

###Parameters:
Accepted URL parameters for changing the map view are:
   - binmax    = # (float)                : sets maximum binning value,       defaults to 95th percentile
   - binmin    = # (float)                : sets minimum binning value,       defaults to 5th percentile
   - bincount  = # (int)                  : sets number of bins,              defaults to 3
   - view      = max or min or extreme    : sets the value for the station,   defaults to max
   - coloring  = ascending or descending  : sets the coloring of the icons,   defaults to 'green to red'

###Metric Information:
The metric information is from the IRIS MUSTANG metric service.

###Displayed Values:
Each station can only be respresented by one value. The value is determined by taking the median of the values for each channel and then either the maximum, minimum, or most extreme of the values from the B, H, and E channels. The stations used in determining the value are highlighted on the station's pop-up. The type of value chosen is set by the user. 

###Binning: 
The coloring of icons is determined by sorting the displayed values into bins. The upper and lower limits of binned values and the number of bins are configured by the user. The bins are even width and inclusive at the lower boundary and exclusive at the upper boundary. Any values that are outside of the limits of the bins are categorized as high or low outliers. 

###Key:
The key has checkboxes for each "bin" that allows users to toggle the corresponding values on the map. The histogram on the key represents the proportion of stations that fall into that bin. 

Libraries:
----------
- Angular.js
- Angular Material
- Leaflet.js
- RainbowVis-JS
- Angular-leaflet-directive.js

Installation:
------------
Mustangular entirely static and can be served via any frontend web server by cloning the contents of public into the DocumentRoot of your webserver of VirtualHost.